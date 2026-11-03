/** 덱 유형 — 캐릭터마다 어울리는 유형의 카드가 보상에 더 자주 나온다 */
export type ArchetypeId = 'rapid' | 'burn' | 'pressure' | 'barrier' | 'overheat';

export const ARCHETYPES: Record<ArchetypeId, { name: string; cards: string[] }> = {
  rapid: {
    name: '연사',
    cards: [
      'linked_cogs', 'chain_drive', 'rapid_cog', 'gear_magazine', 'high_gear', 'cog_barrage',
      'autoloader', 'endless_spring', 'flywheel', 'grand_clock', 'gear_storm', 'rune_circuit', 'overload_circuit',
    ],
  },
  burn: {
    name: '지속 피해',
    cards: [
      'scald', 'boiling_pipe', 'heat_wave', 'combustion', 'rekindle', 'furnace',
      'acid_flask', 'acid_spray', 'dissolve', 'acid_catalyst', 'acid_pump',
      'tesla_coil', 'static_charge', 'arc_lash', 'storm_generator', 'chain_reaction', 'total_detonation',
    ],
  },
  pressure: {
    name: '압력',
    cards: [
      'charge_pressure', 'valve_lock', 'steam_cannon', 'double_compress', 'compressor', 'steam_ram',
      'gauge_strike', 'overpressure', 'residual_valve', 'turbocharger', 'piston',
    ],
  },
  barrier: {
    name: '방벽',
    cards: ['iron_wall', 'counter_stance', 'shield_bash', 'spike_armor', 'steam_barrier', 'pressure_release', 'time_reverse', 'ether_drain'],
  },
  overheat: {
    name: '과열',
    cards: [
      'heat_release', 'critical_boost', 'coolant_cycle', 'heatsink', 'meltdown_engine', 'overload_strike',
      'thermal_lance', 'exhaust_blast', 'afterburner', 'redline', 'coolant',
    ],
  },
};
