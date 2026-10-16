export const LIGHT_POWER_W = 400;
export const AC_POWER_W = 1800;
export const TARIFF_RUPEES_PER_KWH = 8;
export const CARBON_KG_PER_KWH = 0.82;
export const CLASSROOM_CAPACITY = 12;

export function calculateEnergy({
  lightsOn,
  acOn,
  hours,
  lightPowerW = LIGHT_POWER_W,
  acPowerW = AC_POWER_W,
  activeLights,
  activeAcUnits,
}) {
  const lightLoad = activeLights == null
    ? (lightsOn ? lightPowerW : 0)
    : (Math.max(0, Math.min(10, activeLights)) * lightPowerW) / 10;
  const acLoad = activeAcUnits == null
    ? (acOn ? acPowerW : 0)
    : (Math.max(0, Math.min(3, activeAcUnits)) * acPowerW) / 3;
  const powerW = lightLoad + acLoad;

  return {
    totalPowerW: powerW,
    energyKwh: (powerW * hours) / 1000,
  };
}

export function calculateSavings({
  baseline,
  simulated,
  tariff = TARIFF_RUPEES_PER_KWH,
}) {
  const savedKwh = Math.max(0, baseline.energyKwh - simulated.energyKwh);

  return {
    savedKwh,
    savedCost: savedKwh * tariff,
    savedCarbonKg: savedKwh * CARBON_KG_PER_KWH,
  };
}

// Payload for the backend POST /simulate endpoint. Baseline assumes everything
// runs for the full operating period; the simulated scenario zeroes any
// equipment that has been switched off.
export function buildSimulationPayload({ lightsOn, acOn, hours, lightUnits, acUnits }) {
  if (Array.isArray(lightUnits) && Array.isArray(acUnits)) {
    return [
      ...lightUnits.map((enabled, index) => ({
        name: `Classroom light ${index + 1}`,
        power_watts: LIGHT_POWER_W / 10,
        current_hours: hours,
        simulated_hours: enabled ? hours : 0,
      })),
      ...acUnits.map((enabled, index) => ({
        name: `Classroom AC ${index + 1}`,
        power_watts: AC_POWER_W / 3,
        current_hours: hours,
        simulated_hours: enabled ? hours : 0,
      })),
    ];
  }
  return [
    {
      name: "Classroom lights",
      power_watts: LIGHT_POWER_W,
      current_hours: hours,
      simulated_hours: lightsOn ? hours : 0,
    },
    {
      name: "Air conditioning",
      power_watts: AC_POWER_W,
      current_hours: hours,
      simulated_hours: acOn ? hours : 0,
    },
  ];
}
