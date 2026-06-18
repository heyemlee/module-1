import { buildFloorPlan } from './src/features/round1/floorplan/plan-geometry';

const normalized = {
  fixtures: {
    sink: { size: 30, relation: "UNDER_WINDOW" },
    dishwasher: { status: "YES", size: 24, relation: "NEAR_SINK" },
    range: { size: 30, relation: "ON_MAIN_RUN" },
    fridge: { size: 36, relation: "ON_MAIN_RUN" }
  },
  layoutSensitiveCabinets: {
    cookingAppliances: { range: { status: "YES", relation: "ON_MAIN_RUN" } }
  },
  openings: { windows: { status: "YES" }, doors: { status: "YES", items: [{location: "BACK_SIDE"}] } },
  room: { length: { value: 180 }, width: { value: 144 } },
  layoutPreference: "L_SHAPE"
};

const dummyCabinets = [
  { kind: "WALL", location: "ON_MAIN_RUN", width: 12, code: "W1230", confirmationRequired: false },
  { kind: "BASE", location: "ON_MAIN_RUN", width: 12, code: "B12", confirmationRequired: false }
];

const plan = buildFloorPlan(normalized as any, dummyCabinets as any, 0, {
  dishwasher: { wall: "TOP", position: 50 },
  sink: { wall: "TOP", position: 100 },
  range: { wall: "TOP", position: 140 },
  fridge: { wall: "TOP", position: 180 }
});

console.log("Dishwasher:", plan.appliances.find(a => a.key === 'dishwasher'));
console.log("Sink:", plan.appliances.find(a => a.key === 'sink'));
console.log("Window:", plan.window);
