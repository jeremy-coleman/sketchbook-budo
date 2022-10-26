import * as THREE from "three"
import { spring, springV } from "sketchbook/core/FunctionLibrary"

export class SimulationFrameVector {
  public position: THREE.Vector3
  public velocity: THREE.Vector3

  constructor(position: THREE.Vector3, velocity: THREE.Vector3) {
    this.position = position
    this.velocity = velocity
  }
}

export abstract class SimulatorBase {
  public mass: any
  public damping: any
  public frameTime: number
  public offset: number
  public abstract cache: any[]

  constructor(fps: number, mass: number, damping: number) {
    this.mass = mass
    this.damping = damping
    this.frameTime = 1 / fps
    this.offset = 0
  }

  public setFPS(value: number): void {
    this.frameTime = 1 / value
  }

  public lastFrame(): any {
    return this.cache[this.cache.length - 1]
  }

  /**
   * Generates frames between last simulation call and the current one
   * @param {timeStep} timeStep
   */
  public generateFrames(timeStep: number): void {
    // Update cache
    // Find out how many frames needs to be generated
    let totalTimeStep = this.offset + timeStep
    let framesToGenerate = Math.floor(totalTimeStep / this.frameTime)
    this.offset = totalTimeStep % this.frameTime

    // Generate simulation frames
    if (framesToGenerate > 0) {
      for (let i = 0; i < framesToGenerate; i++) {
        this.cache.push(this.getFrame(i + 1 === framesToGenerate))
      }
      this.cache = this.cache.slice(-2)
    }
  }

  public abstract getFrame(isLastFrame: boolean): any
  public abstract simulate(timeStep: number): void
}

export class SimulationFrame {
  public position: number
  public velocity: number

  constructor(position: number, velocity: number) {
    this.position = position
    this.velocity = velocity
  }
}

export class RelativeSpringSimulator extends SimulatorBase {
  public position: number
  public velocity: number
  public target: number
  public lastLerp: number
  public cache: SimulationFrame[]

  constructor(
    fps: number,
    mass: number,
    damping: number,
    startPosition: number = 0,
    startVelocity: number = 0
  ) {
    // Construct base
    super(fps, mass, damping)

    // Simulated values
    this.position = startPosition
    this.velocity = startVelocity

    // Simulation parameters
    this.target = 0

    // Last lerped position for relative output
    this.lastLerp = 0

    // Initialize cache by pushing two frames
    this.cache = [] // At least two frames
    for (let i = 0; i < 2; i++) {
      this.cache.push({
        position: startPosition,
        velocity: startVelocity
      })
    }
  }

  /**
   * Advances the simulation by given time step
   * @param {number} timeStep
   */
  public simulate(timeStep: number): void {
    this.generateFrames(timeStep)

    // SpringR lerping
    // Lerp from 0 to next frame
    let lerp = THREE.MathUtils.lerp(
      0,
      this.cache[1].position,
      this.offset / this.frameTime
    )

    // Substract last lerp from current to make output relative
    this.position = lerp - this.lastLerp
    this.lastLerp = lerp

    this.velocity = THREE.MathUtils.lerp(
      this.cache[0].velocity,
      this.cache[1].velocity,
      this.offset / this.frameTime
    )
  }

  /**
   * Gets another simulation frame
   */
  public getFrame(isLastFrame: boolean): SimulationFrame {
    let newFrame = Object.assign({}, this.lastFrame())

    if (isLastFrame) {
      // Reset position
      newFrame.position = 0
      // Transition to next frame
      this.lastLerp = this.lastLerp - this.lastFrame().position
    }

    return spring(
      newFrame.position,
      this.target,
      newFrame.velocity,
      this.mass,
      this.damping
    )
  }
}

export class VectorSpringSimulator extends SimulatorBase {
  public position: THREE.Vector3
  public velocity: THREE.Vector3
  public target: THREE.Vector3
  public cache: SimulationFrameVector[]

  constructor(fps: number, mass: number, damping: number) {
    // Construct base
    super(fps, mass, damping)

    this.init()
  }

  public init(): void {
    this.position = new THREE.Vector3()
    this.velocity = new THREE.Vector3()
    this.target = new THREE.Vector3()

    // Initialize cache by pushing two frames
    this.cache = []
    for (let i = 0; i < 2; i++) {
      this.cache.push(
        new SimulationFrameVector(new THREE.Vector3(), new THREE.Vector3())
      )
    }
  }

  /**
   * Advances the simulation by given time step
   * @param {number} timeStep
   */
  public simulate(timeStep: number): void {
    // Generate new frames
    this.generateFrames(timeStep)

    // Return interpolation
    this.position.lerpVectors(
      this.cache[0].position,
      this.cache[1].position,
      this.offset / this.frameTime
    )
    this.velocity.lerpVectors(
      this.cache[0].velocity,
      this.cache[1].velocity,
      this.offset / this.frameTime
    )
  }

  /**
   * Gets another simulation frame
   */
  public getFrame(isLastFrame: boolean): SimulationFrameVector {
    // Deep clone data from previous frame
    let newSpring = new SimulationFrameVector(
      this.lastFrame().position.clone(),
      this.lastFrame().velocity.clone()
    )

    // Calculate new Spring
    springV(
      newSpring.position,
      this.target,
      newSpring.velocity,
      this.mass,
      this.damping
    )

    // Return new Spring
    return newSpring
  }
}

export class SpringSimulator extends SimulatorBase {
  public position: number
  public velocity: number
  public target: number
  public cache: SimulationFrame[]

  constructor(
    fps: number,
    mass: number,
    damping: number,
    startPosition: number = 0,
    startVelocity: number = 0
  ) {
    // Construct base
    super(fps, mass, damping)

    // Simulated values
    this.position = startPosition
    this.velocity = startVelocity

    // Simulation parameters
    this.target = 0

    // Initialize cache by pushing two frames
    this.cache = [] // At least two frames
    for (let i = 0; i < 2; i++) {
      this.cache.push(new SimulationFrame(startPosition, startVelocity))
    }
  }

  /**
   * Advances the simulation by given time step
   * @param {number} timeStep
   */
  public simulate(timeStep: number): void {
    // Generate new frames
    this.generateFrames(timeStep)

    // Return values interpolated between cached frames
    this.position = THREE.MathUtils.lerp(
      this.cache[0].position,
      this.cache[1].position,
      this.offset / this.frameTime
    )
    this.velocity = THREE.MathUtils.lerp(
      this.cache[0].velocity,
      this.cache[1].velocity,
      this.offset / this.frameTime
    )
  }

  /**
   * Gets another simulation frame
   */
  public getFrame(isLastFrame: boolean): SimulationFrame {
    return spring(
      this.lastFrame().position,
      this.target,
      this.lastFrame().velocity,
      this.mass,
      this.damping
    )
  }
}
