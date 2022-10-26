import * as Utils from "sketchbook/core/FunctionLibrary"
import { ICharacterAI } from "sketchbook/core/interfaces"
import { CANNON } from "sketchbook/physics"
import { PathNode } from "sketchbook/world/Path"
import * as THREE from "three"
import { Character } from "./Character"
import { Vehicle } from "./vehicles/Vehicle"

export class FollowTarget implements ICharacterAI {
  public character: Character
  public isTargetReached: boolean

  public target: THREE.Object3D
  private stopDistance: number

  constructor(target: THREE.Object3D, stopDistance: number = 1.3) {
    this.target = target
    this.stopDistance = stopDistance
  }

  public setTarget(target: THREE.Object3D): void {
    this.target = target
  }

  public update(timeStep: number): void {
    if (this.character.controlledObject !== undefined) {
      let source = new THREE.Vector3()
      let target = new THREE.Vector3()

      this.character.getWorldPosition(source)
      this.target.getWorldPosition(target)

      let viewVector = new THREE.Vector3().subVectors(target, source)

      // Follow character
      if (viewVector.length() > this.stopDistance) {
        this.isTargetReached = false
      } else {
        this.isTargetReached = true
      }

      let forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
        (this.character.controlledObject as unknown as THREE.Object3D)
          .quaternion
      )
      viewVector.y = 0
      viewVector.normalize()
      let angle = Utils.getSignedAngleBetweenVectors(forward, viewVector)

      let goingForward =
        forward.dot(
          Utils.threeVector(
            (this.character.controlledObject as unknown as Vehicle).collision
              .velocity
          )
        ) > 0
      let speed = (
        this.character.controlledObject as unknown as Vehicle
      ).collision.velocity.length()

      if (forward.dot(viewVector) < 0.0) {
        this.character.controlledObject.triggerAction("reverse", true)
        this.character.controlledObject.triggerAction("throttle", false)
      } else {
        this.character.controlledObject.triggerAction("throttle", true)
        this.character.controlledObject.triggerAction("reverse", false)
      }

      if (Math.abs(angle) > 0.15) {
        if (forward.dot(viewVector) > 0 || goingForward) {
          if (angle > 0) {
            this.character.controlledObject.triggerAction("left", true)
            this.character.controlledObject.triggerAction("right", false)
          } else {
            this.character.controlledObject.triggerAction("right", true)
            this.character.controlledObject.triggerAction("left", false)
          }
        } else {
          if (angle > 0) {
            this.character.controlledObject.triggerAction("right", true)
            this.character.controlledObject.triggerAction("left", false)
          } else {
            this.character.controlledObject.triggerAction("left", true)
            this.character.controlledObject.triggerAction("right", false)
          }
        }
      } else {
        this.character.controlledObject.triggerAction("left", false)
        this.character.controlledObject.triggerAction("right", false)
      }
    } else {
      let viewVector = new THREE.Vector3().subVectors(
        this.target.position,
        this.character.position
      )
      this.character.setViewVector(viewVector)

      // Follow character
      if (viewVector.length() > this.stopDistance) {
        this.isTargetReached = false
        this.character.triggerAction("up", true)
      }
      // Stand still
      else {
        this.isTargetReached = true
        this.character.triggerAction("up", false)

        // Look at character
        this.character.setOrientation(viewVector)
      }
    }
  }
}

export class FollowPath extends FollowTarget implements ICharacterAI {
  public nodeRadius: number
  public reverse: boolean = false

  private staleTimer: number = 0
  private targetNode: PathNode

  constructor(firstNode: PathNode, nodeRadius: number) {
    super(firstNode.object, 0)
    this.nodeRadius = nodeRadius
    this.targetNode = firstNode
  }

  public update(timeStep: number): void {
    super.update(timeStep)

    // Todo only compute once in followTarget
    let source = new THREE.Vector3()
    let target = new THREE.Vector3()
    this.character.getWorldPosition(source)
    this.target.getWorldPosition(target)
    let viewVector = new THREE.Vector3().subVectors(target, source)
    viewVector.y = 0

    let targetToNextNode = this.targetNode.nextNode.object.position
      .clone()
      .sub(this.targetNode.object.position)
    targetToNextNode.y = 0
    targetToNextNode.normalize()
    let slowDownAngle = viewVector.clone().normalize().dot(targetToNextNode)
    let speed = (
      this.character.controlledObject as unknown as Vehicle
    ).collision.velocity.length()

    // console.log(slowDownAngle, viewVector.length(), speed);
    if (slowDownAngle < 0.7 && viewVector.length() < 50 && speed > 10) {
      this.character.controlledObject.triggerAction("reverse", true)
      this.character.controlledObject.triggerAction("throttle", false)
    }

    if (
      speed < 1 ||
      (this.character.controlledObject as unknown as Vehicle).rayCastVehicle
        .numWheelsOnGround === 0
    )
      this.staleTimer += timeStep
    else this.staleTimer = 0
    if (this.staleTimer > 5) {
      let worldPos = new THREE.Vector3()
      this.targetNode.object.getWorldPosition(worldPos)
      worldPos.y += 3
      ;(
        this.character.controlledObject as unknown as Vehicle
      ).collision.position = Utils.cannonVector(worldPos)
      ;(
        this.character.controlledObject as unknown as Vehicle
      ).collision.interpolatedPosition = Utils.cannonVector(worldPos)
      ;(
        this.character.controlledObject as unknown as Vehicle
      ).collision.angularVelocity = new CANNON.Vec3()
      ;(
        this.character.controlledObject as unknown as Vehicle
      ).collision.quaternion.copy(
        (this.character.controlledObject as unknown as Vehicle).collision
          .initQuaternion
      )
      this.staleTimer = 0
    }

    if (viewVector.length() < this.nodeRadius) {
      if (this.reverse) {
        super.setTarget(this.targetNode.previousNode.object)
        this.targetNode = this.targetNode.previousNode
      } else {
        super.setTarget(this.targetNode.nextNode.object)
        this.targetNode = this.targetNode.nextNode
      }
    }
  }
}

export class RandomBehaviour implements ICharacterAI {
  public character: Character
  private randomFrequency: number

  constructor(randomFrequency: number = 100) {
    this.randomFrequency = randomFrequency
  }

  public update(timeStep: number): void {
    let rndInt = Math.floor(Math.random() * this.randomFrequency)
    let rndBool = Math.random() > 0.5 ? true : false

    if (rndInt === 0) {
      this.character.setViewVector(
        new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        )
      )

      this.character.triggerAction("up", true)
      this.character.charState.update(timeStep)
      this.character.triggerAction("up", false)
    } else if (rndInt === 1) {
      this.character.triggerAction("up", rndBool)
    } else if (rndInt === 2) {
      this.character.triggerAction("run", rndBool)
    } else if (rndInt === 3) {
      this.character.triggerAction("jump", rndBool)
    }
  }
}
