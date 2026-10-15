import { calculateEnergy } from "../services/energyCalculations";

export const FLOORS = [
  { id: 1, label: "Ground floor", rooms: [
    { id: "A-101", name: "Learning studio", kind: "Connected room", kwh: 4.4, people: 3 },
    { id: "A-102", name: "Seminar room", kind: "Seminar", kwh: 2.8, people: 0 },
    { id: "A-103", name: "Project lab", kind: "Project lab", kwh: 5.6, people: 8 },
  ] },
  { id: 2, label: "First floor", rooms: [
    { id: "A-201", name: "Lecture hall", kind: "Lecture hall", kwh: 8.2, people: 5 },
    { id: "A-202", name: "Study commons", kind: "Study commons", kwh: 3.1, people: 7 },
    { id: "A-203", name: "Design studio", kind: "Design studio", kwh: 4.7, people: 2 },
  ] },
  { id: 3, label: "Second floor", rooms: [
    { id: "A-301", name: "Research lab", kind: "Research lab", kwh: 7.4, people: 8 },
    { id: "A-302", name: "Computer lab", kind: "Computer lab", kwh: 9.1, people: 4 },
    { id: "A-303", name: "Quiet library", kind: "Library", kwh: 3.8, people: 6 },
  ] },
];

export function getRoomSnapshot(roomId, settings, equipment, occupancyOverride) {
  const room = FLOORS.flatMap((floor) => floor.rooms).find((item) => item.id === roomId) || FLOORS[0].rooms[0];
  const connected = room.id === "A-101";
  const activeLoadFraction = equipment
    ? ((equipment.lights?.filter(Boolean).length ?? 10) * 40 + (equipment.acs?.filter(Boolean).length ?? 3) * 600) / 2200
    : 1;
  return {
    ...room,
    connected,
    energyKwh: connected
      ? calculateEnergy({
        lightsOn: settings.lightsOn,
        acOn: settings.acOn,
        hours: settings.hours,
        activeLights: equipment?.lights?.filter(Boolean).length,
        activeAcUnits: equipment?.acs?.filter(Boolean).length,
      }).energyKwh
      : room.kwh * activeLoadFraction,
    occupancy: connected ? settings.occupancy : (occupancyOverride ?? room.people),
    lightsOn: connected ? settings.lightsOn : true,
    acOn: connected ? settings.acOn : true,
  };
}
