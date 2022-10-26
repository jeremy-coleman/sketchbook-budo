import { Character } from "../Character"
import { StartWalkBase } from "./_stateLibrary"

export class StartWalkBackRight extends StartWalkBase {
  constructor(character: Character) {
    super(character)
    this.animationLength = character.setAnimation("start_back_right", 0.1)
  }
}
