import { VehicleSeat } from 'sketchbook/vehicles/VehicleSeat';
import { Character } from '../../Character';
import {
    CharacterStateBase
} from '../_stateLibrary';
import { CloseVehicleDoorInside } from './CloseVehicleDoorInside';

export class Driving extends CharacterStateBase
{
	private seat: VehicleSeat;

	constructor(character: Character, seat: VehicleSeat)
	{
		super(character);

		this.seat = seat;
		this.canFindVehiclesToEnter = false;
		this.playAnimation('driving', 0.1);

		this.character.startControllingVehicle(seat.vehicle, this.seat);
		this.seat.vehicle.onInputChange();
		this.character.vehicleEntryInstance = null;
	}

	public update(timeStep: number): void
	{
		super.update(timeStep);

		if (!this.seat.door?.achievingTargetRotation && this.seat.door?.rotation > 0 && this.seat.vehicle.noDirectionPressed())
		{
			this.character.setState(new CloseVehicleDoorInside(this.character, this.seat));
		}
	}
}