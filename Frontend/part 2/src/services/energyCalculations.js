export function calculateEnergy({
  lightsOn,
  acOn,
  hours,
  lightPowerW = 400,
  acPowerW = 1800,
}) {
  const powerW =
    (lightsOn ? lightPowerW : 0) +
    (acOn ? acPowerW : 0);

  return {
    totalPowerW: powerW,
    energyKwh: (powerW * hours) / 1000,
  };
}

export function calculateSavings({
  baseline,
  simulated,
  tariff = 8,
}) {
  const savedKwh =
    baseline.energyKwh - simulated.energyKwh;

  return {
    savedKwh,
    savedCost: savedKwh * tariff,
  };
}