export enum Space {
  Local = "local",
  Global = "global"
}

export enum Side {
  Left = "left",
  Right = "right"
}

export enum SeatType {
  Driver = "driver",
  Passenger = "passenger"
}
export enum EntityType {
  Character,
  Airplane,
  Car,
  Helicopter,
  Decoration,
  System
}
export enum CollisionGroups {
  Default = 1,
  Characters = 2,
  TrimeshColliders = 4
}
