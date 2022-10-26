import * as Utils from "sketchbook/core/FunctionLibrary"
import { ISpawnPoint } from "sketchbook/core/interfaces"
import { LoadingManager } from "sketchbook/core/LoadingManager"
import { FollowPath } from "sketchbook/pawns/ai"
import { Character } from "sketchbook/pawns/Character"
import { Airplane } from "sketchbook/pawns/vehicles/Airplane"
import { Car } from "sketchbook/pawns/vehicles/Car"
import { Helicopter } from "sketchbook/pawns/vehicles/Helicopter"
import { Vehicle } from "sketchbook/pawns/vehicles/Vehicle"
import { World } from "sketchbook/world/World"
import * as THREE from "three"

export class VehicleSpawnPoint implements ISpawnPoint {
  public type: string
  public driver: string
  public firstAINode: string

  private object: THREE.Object3D

  constructor(object: THREE.Object3D) {
    this.object = object
  }

  public spawn(loadingManager: LoadingManager, world: World): void {
    loadingManager.loadGLTF("assets/" + this.type + ".glb", (model: any) => {
      let vehicle: Vehicle = this.getNewVehicleByType(model, this.type)
      vehicle.spawnPoint = this.object

      let worldPos = new THREE.Vector3()
      let worldQuat = new THREE.Quaternion()
      this.object.getWorldPosition(worldPos)
      this.object.getWorldQuaternion(worldQuat)

      vehicle.setPosition(worldPos.x, worldPos.y + 1, worldPos.z)
      vehicle.collision.quaternion.copy(Utils.cannonQuat(worldQuat))
      world.add(vehicle)

      if (this.driver !== undefined) {
        loadingManager.loadGLTF("assets/boxman.glb", (charModel) => {
          let character = new Character(charModel)
          world.add(character)
          character.teleportToVehicle(vehicle, vehicle.seats[0])

          if (this.driver === "player") {
            character.takeControl()
          } else if (this.driver === "ai") {
            if (this.firstAINode !== undefined) {
              let nodeFound = false
              for (const pathName in world.paths) {
                if (world.paths.hasOwnProperty(pathName)) {
                  const path = world.paths[pathName]

                  for (const nodeName in path.nodes) {
                    if (
                      Object.prototype.hasOwnProperty.call(path.nodes, nodeName)
                    ) {
                      const node = path.nodes[nodeName]

                      if (node.object.name === this.firstAINode) {
                        character.setBehaviour(new FollowPath(node, 10))
                        nodeFound = true
                      }
                    }
                  }
                }
              }

              if (!nodeFound) {
                console.error("Path node " + this.firstAINode + "not found.")
              }
            }
          }
        })
      }
    })
  }

  private getNewVehicleByType(model: any, type: string): Vehicle {
    switch (type) {
      case "car":
        return new Car(model)
      case "heli":
        return new Helicopter(model)
      case "airplane":
        return new Airplane(model)
    }
  }
}
