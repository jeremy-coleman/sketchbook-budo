import { KeyBinding } from "sketchbook/core/KeyBinding"
import { LoadingManager } from "sketchbook/core/LoadingManager"
import { EntityType } from "sketchbook/core/enums"
import { Character } from "sketchbook/pawns/Character"
import { VehicleSeat } from "sketchbook/pawns/vehicles/VehicleSeat"
import { World } from "sketchbook/world/World"

export interface IWorldEntity extends IUpdatable {
  entityType: EntityType

  addToWorld(world: World): void
  removeFromWorld(world: World): void
}

export interface IUpdatable {
  updateOrder: number
  update(timestep: number, unscaledTimeStep: number): void
}

export interface ISpawnPoint {
  spawn(loadingManager: LoadingManager, world: World): void
}

export interface IInputReceiver {
  actions: { [action: string]: KeyBinding }

  handleKeyboardEvent(
    event: KeyboardEvent,
    code: string,
    pressed: boolean
  ): void
  handleMouseButton(event: MouseEvent, code: string, pressed: boolean): void
  handleMouseMove(event: MouseEvent, deltaX: number, deltaY: number): void
  handleMouseWheel(event: WheelEvent, value: number): void

  inputReceiverInit(): void
  inputReceiverUpdate(timeStep: number): void
}

export interface IControllable extends IInputReceiver {
  entityType: EntityType
  seats: VehicleSeat[]
  position: THREE.Vector3
  controllingCharacter: Character

  triggerAction(actionName: string, value: boolean): void
  resetControls(): void
  allowSleep(value: boolean): void
  onInputChange(): void
  noDirectionPressed(): boolean
}

export interface ICharacterState {
  canFindVehiclesToEnter: boolean // Find a suitable car and run towards it
  canEnterVehicles: boolean // Actually get into the vehicle
  canLeaveVehicles: boolean

  update(timeStep: number): void
  onInputChange(): void
}

export interface ICharacterAI {
  character: Character
  update(timeStep: number): void
}
