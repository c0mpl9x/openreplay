import { describe, expect, it } from 'vitest';

import { ReplayFrameFlags } from '../replay/types';
import type { ParseRequest, ParserStage } from './protocol';
import {
  PARSED_EVENT_NAMES,
  PARSED_EVENT_PLAYER_PROPERTIES,
  PARSED_PLAYER_PROPERTIES,
  parseReplayWithBindings,
  type DemoparserBindings,
} from './adapter';
import {
  assertSupportedHeader,
  parserRecord,
  parserRows,
  replayRoundsFromRows,
  selectReplaySampleTicks,
  type RawParserRow,
} from './normalizer';

function demoRequest(): ParseRequest {
  const buffer = new ArrayBuffer(16);
  new Uint8Array(buffer).set([0x50, 0x42, 0x44, 0x45, 0x4d, 0x53, 0x32, 0x00]);
  return {
    type: 'parse',
    fileName: 'mirage.dem',
    size: buffer.byteLength,
    buffer,
    wasmModuleUrl: '/parser/demoparser2.js',
  };
}

const eventRows: RawParserRow[] = [
  {
    event_name: 'round_start',
    tick: 0,
    total_rounds_played: 0,
    is_warmup_period: false,
  },
  {
    event_name: 'round_freeze_end',
    tick: 8,
    total_rounds_played: 0,
    is_warmup_period: false,
  },
  {
    event_name: 'player_death',
    tick: 12,
    user_steamid: '222',
    user_name: 'Bravo',
    attacker_steamid: '111',
    attacker_name: 'Alpha',
    assister_steamid: '0',
    headshot: 'true',
    weapon: 'ak47',
  },
  {
    event_name: 'bomb_planted',
    tick: 16,
    user_steamid: '111',
    user_name: 'Alpha',
    user_last_place_name: 'BombsiteB',
    site: 185,
  },
  {
    event_name: 'bomb_exploded',
    tick: 20,
    user_last_place_name: 'CTSpawn',
    site: 185,
  },
  {
    event_name: 'round_end',
    tick: 24,
    total_rounds_played: 0,
    winner: 'CT',
    reason: 'defused',
    is_warmup_period: false,
  },
];

function fixtureBindings(): DemoparserBindings {
  return {
    parseHeader: () =>
      new Map<string, unknown>([
        ['demo_file_stamp', 'PBDEMS2\0'],
        ['client_name', 'SourceTV Demo'],
        ['map_name', 'de_mirage'],
        ['server_name', 'Fixture server'],
        ['playback_ticks_per_second', '64'],
      ]),
    parseEvents: (_bytes, names, playerProperties) => {
      expect(names).toEqual([...PARSED_EVENT_NAMES]);
      expect(playerProperties).toEqual([...PARSED_EVENT_PLAYER_PROPERTIES]);
      return eventRows.map((row) => new Map(Object.entries(row)));
    },
    parseTicks: (_bytes, properties, ticks, players, structOfArrays) => {
      expect(properties).toEqual([...PARSED_PLAYER_PROPERTIES]);
      expect(players).toEqual([]);
      expect(structOfArrays).toBe(false);
      return Array.from(ticks ?? [])
        .flatMap((tick) => [
          {
            tick,
            steamid: '111',
            name: 'Alpha',
            X: tick,
            Y: tick + 1,
            Z: 10,
            yaw: 90,
            health: 100,
            armor_value: 50,
            is_alive: true,
            team_num: 2,
          },
          {
            tick,
            steamid: '222',
            name: 'Bravo',
            X: tick + 2,
            Y: tick + 3,
            Z: 10,
            yaw: 180,
            health: tick < 12 ? 100 : 0,
            armor_value: 25,
            is_alive: tick < 12,
            team_num: 3,
          },
        ])
        .map((row) => new Map(Object.entries(row)));
    },
  };
}

describe('demoparser adapter', () => {
  it('queries, samples, and compacts a Mirage GOTV demo', () => {
    const stages: ParserStage[] = [];
    const replay = parseReplayWithBindings(demoRequest(), fixtureBindings(), (stage) =>
      stages.push(stage),
    );

    expect(stages).toEqual(['validating', 'metadata', 'events', 'positions', 'normalizing']);
    expect(replay.meta).toEqual({
      fileName: 'mirage.dem',
      mapName: 'de_mirage',
      serverName: 'Fixture server',
      tickRate: 64,
      durationTicks: 24,
    });
    expect(replay.rounds).toEqual([
      {
        number: 1,
        startTick: 0,
        freezeEndTick: 8,
        endTick: 24,
        winner: 3,
        reason: 'defused',
      },
    ]);
    expect([...replay.frames.ticks]).toEqual([8, 12, 16, 20, 24]);
    expect(replay.frames.playerCount).toBe(2);
    expect(replay.frames.flags[0]).toBe(ReplayFrameFlags.Present | ReplayFrameFlags.Alive);
    expect(replay.frames.flags[3]).toBe(ReplayFrameFlags.Present);
    expect(replay.events).toEqual([
      {
        type: 'kill',
        tick: 12,
        roundNumber: 1,
        victimId: 1,
        killerId: 0,
        headshot: true,
        weapon: 'ak47',
      },
      {
        type: 'bomb_planted',
        tick: 16,
        roundNumber: 1,
        playerId: 0,
        site: 'B',
      },
      {
        type: 'bomb_exploded',
        tick: 20,
        roundNumber: 1,
        site: 'B',
      },
    ]);
  });

  it('keeps distinct Steam IDs when players share the same display name', () => {
    const bindings = fixtureBindings();
    const parseTicks = bindings.parseTicks.bind(bindings);
    bindings.parseTicks = (bytes, properties, ticks, players, structOfArrays) => {
      const rows = parseTicks(bytes, properties, ticks, players, structOfArrays) as Map<
        string,
        unknown
      >[];
      return [
        ...rows,
        ...Array.from(ticks ?? []).map(
          (tick) =>
            new Map<string, unknown>([
              ['tick', tick],
              ['steamid', '333'],
              ['name', 'Alpha'],
              ['X', tick + 4],
              ['Y', tick + 5],
              ['Z', 10],
              ['yaw', 270],
              ['health', 100],
              ['armor_value', 0],
              ['is_alive', true],
              ['team_num', 2],
            ]),
        ),
      ];
    };

    const replay = parseReplayWithBindings(demoRequest(), bindings, () => undefined);
    expect(replay.players.filter((player) => player.name === 'Alpha')).toHaveLength(2);
    expect(replay.players.map((player) => player.steamId)).toEqual(['111', '222', '333']);
  });

  it('rejects mismatched transfers and unsupported parsed metadata', () => {
    const mismatch = demoRequest();
    expect(() =>
      parseReplayWithBindings(
        { ...mismatch, size: mismatch.size + 1 },
        fixtureBindings(),
        () => undefined,
      ),
    ).toThrow(/transferred demo size/iu);

    expect(() =>
      assertSupportedHeader({
        demo_file_stamp: 'PBDEMS2\0',
        client_name: 'Player POV',
        map_name: 'de_mirage',
      }),
    ).toThrow(/POV demo/iu);
    expect(() =>
      assertSupportedHeader({
        demo_file_stamp: 'PBDEMS2\0',
        client_name: 'SourceTV Demo',
        map_name: 'de_dust2',
      }),
    ).toThrow(/de_dust2/iu);
    expect(() => assertSupportedHeader({ client_name: 'SourceTV Demo' })).toThrow(
      /verify the CS2 demo header/iu,
    );
  });

  it('validates untyped binding responses', () => {
    expect(parserRecord({ map_name: 'de_mirage' }, 'header')).toEqual({
      map_name: 'de_mirage',
    });
    expect(parserRows([{ tick: 1 }], 'ticks')).toEqual([{ tick: 1 }]);
    expect(
      parserRecord(
        new Map([
          ['map_name', 'de_mirage'],
          ['client_name', 'SourceTV'],
        ]),
        'header',
      ),
    ).toEqual({ map_name: 'de_mirage', client_name: 'SourceTV' });
    expect(parserRows([new Map([['tick', 1]])], 'ticks')).toEqual([{ tick: 1 }]);
    expect(() => parserRecord([], 'header')).toThrow(/invalid header response/iu);
    expect(() => parserRecord(new Map([[1, 'invalid']]), 'header')).toThrow(
      /invalid header response/iu,
    );
    expect(() => parserRows([null], 'ticks')).toThrow(/invalid ticks response/iu);
  });

  it('excludes warmup and incomplete rounds and keeps exact event ticks', () => {
    const rows: RawParserRow[] = [
      {
        event_name: 'round_start',
        tick: 0,
        is_warmup_period: true,
      },
      { event_name: 'round_end', tick: 4, is_warmup_period: true },
      { event_name: 'round_start', tick: 10 },
      { event_name: 'round_end', tick: 30, winner: 'T' },
      { event_name: 'round_start', tick: 40 },
      { event_name: 'player_death', tick: 17 },
    ];
    const rounds = replayRoundsFromRows(rows);
    expect(rounds).toEqual([
      {
        number: 2,
        startTick: 10,
        freezeEndTick: 10,
        endTick: 30,
        winner: 2,
      },
    ]);
    expect([...selectReplaySampleTicks(rounds, rows)]).toEqual([10, 17, 18, 26, 30]);
  });

  it('pairs GOTV rounds when total_rounds_played advances at round_end', () => {
    const rows: RawParserRow[] = [
      {
        event_name: 'round_start',
        tick: 66,
        round: 1,
        total_rounds_played: 0,
        is_warmup_period: false,
      },
      {
        event_name: 'round_freeze_end',
        tick: 674,
        total_rounds_played: 0,
        is_warmup_period: false,
      },
      {
        event_name: 'round_end',
        tick: 1842,
        round: 1,
        total_rounds_played: 1,
        is_warmup_period: false,
      },
      {
        event_name: 'round_start',
        tick: 5591,
        round: 1,
        total_rounds_played: 0,
        is_warmup_period: false,
      },
      {
        event_name: 'round_freeze_end',
        tick: 6871,
        total_rounds_played: 0,
        is_warmup_period: false,
      },
      {
        event_name: 'round_end',
        tick: 9689,
        round: 2,
        total_rounds_played: 1,
        is_warmup_period: false,
      },
    ];

    expect(replayRoundsFromRows(rows)).toEqual([
      { number: 1, startTick: 66, freezeEndTick: 674, endTick: 1842 },
      { number: 2, startTick: 5591, freezeEndTick: 6871, endTick: 9689 },
    ]);
  });
});
