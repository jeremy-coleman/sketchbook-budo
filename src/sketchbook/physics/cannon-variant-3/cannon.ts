var version = "0.6.2"

import {
  Equation,
  ContactEquation,
  FrictionEquation,
  RotationalMotorEquation,
  RotationalEquation,
  PointToPointConstraint,
  Constraint,
  Shape,
  ConvexPolyhedron,
  Box,
  Cylinder,
  Trimesh,
  Plane,
  Sphere,
  Narrowphase,
  AABB,
  ArrayCollisionMatrix,
  ConeTwistConstraint,
  DistanceConstraint,
  HingeConstraint,
  LockConstraint,
  Broadphase,
  GridBroadphase,
  NaiveBroadphase,
  SAPBroadphase,
  Material,
  ContactMaterial,

  Solver,
  SplitSolver,
  GSSolver,
  Heightfield,
  ObjectCollisionMatrix,
  Pool,
  Vec3Pool,
  Particle,
  Quaternion,
  Ray,
  RaycastResult,
  RaycastVehicle,
  RigidVehicle,
  SPHSystem,
  Spring,
  Transform,
  Mat3,
  Body,
  Vec3,
  WheelInfo,
  JacobianElement,
} from "cannon-es"

//IMPORTANT FOR COMPAT BETWEEN ORGINAL CANNON AND UPDATED CANNON. PEOPLE FUCKING LOVE TO NEEDLESSLY BREAK THINGS

//do this one if NOT importing from cannon-es (providing shim to match cannon-es)
//Body.prototype.updateAABB = Body.prototype.computeAABB

//do this one if importing from cannon-es (providing alias from cannon-es to ours)
//@ts-ignore
Body.prototype.computeAABB = Body.prototype.updateAABB

//@ts-ignore
Vec3.prototype.mult = function mult(scalar, target) {
  target = target || new Vec3()
  var x = this.x,
    y = this.y,
    z = this.z
  target.x = scalar * x
  target.y = scalar * y
  target.z = scalar * z
  return target
}

//@ts-ignore
Vec3.prototype.norm = function norm() {
  const { x, y, z } = this
  return Math.sqrt(x * x + y * y + z * z)
}

//@ts-ignore
Vec3.prototype.norm2 = function norm2() {
  return this.dot(this)
}

function unpackAndPush(array, key) {
  array.push((key & 0xffff0000) >> 16, key & 0x0000ffff)
}

export class OverlapKeeper {
  current: number[] = []
  previous: number[] = []

  getKey(i: number, j: number): number {
    if (j < i) {
      const temp = j
      j = i
      i = temp
    }
    return (i << 16) | j
  }

  set(i: number, j: number): void {
    // Insertion sort. This way the diff will have linear complexity.
    const key = this.getKey(i, j)
    const current = this.current
    let index = 0
    while (key > current[index]) {
      index++
    }
    if (key === current[index]) {
      return // Pair was already added
    }
    for (let j = current.length - 1; j >= index; j--) {
      current[j + 1] = current[j]
    }
    current[index] = key
  }

  tick(): void {
    const tmp = this.current
    this.current = this.previous
    this.previous = tmp
    this.current.length = 0
  }

  getDiff(additions: number[], removals: number[]): void {
    const a = this.current
    const b = this.previous
    const al = a.length
    const bl = b.length

    let j = 0
    for (let i = 0; i < al; i++) {
      let found = false
      const keyA = a[i]
      while (keyA > b[j]) {
        j++
      }
      found = keyA === b[j]

      if (!found) {
        unpackAndPush(additions, keyA)
      }
    }
    j = 0
    for (let i = 0; i < bl; i++) {
      let found = false
      const keyB = b[i]
      while (keyB > a[j]) {
        j++
      }
      found = a[j] === keyB
      if (!found) {
        unpackAndPush(removals, keyB)
      }
    }
  }
}

//this things only use is for world to extend it
//leaving it for now but, either inline it or use broadcast channel for world workers;
class Emitter {
  _listeners: any

  addEventListener(type, listener) {
    if (this._listeners === undefined) {
      this._listeners = {}
    }
    var listeners = this._listeners
    if (listeners[type] === undefined) {
      listeners[type] = []
    }
    if (listeners[type].indexOf(listener) === -1) {
      listeners[type].push(listener)
    }
    return this
  }

  hasEventListener(type, listener) {
    if (this._listeners === undefined) {
      return false
    }
    var listeners = this._listeners
    if (
      listeners[type] !== undefined &&
      listeners[type].indexOf(listener) !== -1
    ) {
      return true
    }
    return false
  }

  hasAnyEventListener(type) {
    if (this._listeners === undefined) {
      return false
    }
    var listeners = this._listeners
    return listeners[type] !== undefined
  }

  removeEventListener(type, listener) {
    if (this._listeners === undefined) {
      return this
    }
    var listeners = this._listeners
    if (listeners[type] === undefined) {
      return this
    }
    var index = listeners[type].indexOf(listener)
    if (index !== -1) {
      listeners[type].splice(index, 1)
    }
    return this
  }
  dispatchEvent(event) {
    if (this._listeners === undefined) {
      return this
    }
    var listeners = this._listeners
    var listenerArray = listeners[event.type]
    if (listenerArray !== undefined) {
      event.target = this
      for (var i = 0, l = listenerArray.length; i < l; i++) {
        listenerArray[i].call(this, event)
      }
    }
    return this
  }
}

class TupleDictionary {
  data: { keys: any[] }
  constructor() {
    this.data = { keys: [] }
  }

  get(i, j) {
    if (i > j) {
      var temp = j
      j = i
      i = temp
    }
    return this.data[i + "-" + j]
  }
  set(i, j, value) {
    if (i > j) {
      var temp = j
      j = i
      i = temp
    }
    var key = i + "-" + j
    if (!this.get(i, j)) {
      this.data.keys.push(key)
    }
    this.data[key] = value
  }
  reset() {
    var data = this.data,
      keys = data.keys
    while (keys.length > 0) {
      var key = keys.pop()
      delete data[key]
    }
  }
}

// var tmpAABB1 = new AABB()
// var tmpArray1 = []
var tmpRay = new Ray()
//var step_tmp1 = new Vec3()

var World_step_postStepEvent = { type: "postStep" }
var World_step_preStepEvent = { type: "preStep" }
var World_step_collideEvent = {
  type: Body.COLLIDE_EVENT_NAME,
  body: null,
  contact: null
}
var World_step_oldContacts = []
var World_step_frictionEquationPool = []
var World_step_p1 = []
var World_step_p2 = []

// var World_step_gvec = new Vec3()
// var World_step_vi = new Vec3()
// var World_step_vj = new Vec3()
// var World_step_wi = new Vec3()
// var World_step_wj = new Vec3()
// var World_step_t1 = new Vec3()
// var World_step_t2 = new Vec3()
// var World_step_rixn = new Vec3()
// var World_step_rjxn = new Vec3()
// var World_step_step_q = new Quaternion()
// var World_step_step_w = new Quaternion()
// var World_step_step_wq = new Quaternion()
// var invI_tau_dt = new Vec3()

var clamp01 = function (n) {
  return Math.min(Math.max(n, 0.0), 1.0)
}

class World extends Emitter {
  dt: number
  allowSleep: boolean
  contacts: any[]
  frictionEquations: any[]
  quatNormalizeSkip: any
  quatNormalizeFast: any
  time: number
  interpolationFactor: number
  stepnumber: number
  default_dt: number
  nextId: number
  gravity: any
  broadphase: any
  bodies: any[]
  solver: any
  constraints: any[]
  narrowphase: any
  collisionMatrix: any
  collisionMatrixPrevious: any
  bodyOverlapKeeper: any
  shapeOverlapKeeper: any
  materials: any[]
  contactmaterials: any[]
  contactMaterialTable: TupleDictionary
  defaultMaterial: any
  defaultContactMaterial: any
  doProfiling: boolean
  profile: {
    solve: number
    makeContactConstraints: number
    broadphase: number
    integrate: number
    narrowphase: number
  }
  accumulator: number
  subsystems: any[]
  addBodyEvent: { type: string; body: any }
  removeBodyEvent: { type: string; body: any }
  idToBodyMap: {}
  constructor(options) {
    super()
    options = options || {}
    this.dt = -1
    this.allowSleep = !!options.allowSleep
    this.contacts = []
    this.frictionEquations = []
    this.quatNormalizeSkip =
      options.quatNormalizeSkip !== undefined ? options.quatNormalizeSkip : 0
    this.quatNormalizeFast =
      options.quatNormalizeFast !== undefined
        ? options.quatNormalizeFast
        : false
    this.time = 0.0
    this.interpolationFactor = 0
    this.stepnumber = 0
    this.default_dt = 1 / 60
    this.nextId = 0
    this.gravity = new Vec3()
    if (options.gravity) {
      this.gravity.copy(options.gravity)
    }
    this.broadphase =
      options.broadphase !== undefined
        ? options.broadphase
        : new NaiveBroadphase()
    this.bodies = []
    this.solver = options.solver !== undefined ? options.solver : new GSSolver()
    this.constraints = []
    //@ts-ignore
    this.narrowphase = new Narrowphase(this)
    this.collisionMatrix = new ArrayCollisionMatrix()
    this.collisionMatrixPrevious = new ArrayCollisionMatrix()
    this.bodyOverlapKeeper = new OverlapKeeper()
    this.shapeOverlapKeeper = new OverlapKeeper()
    this.materials = []
    this.contactmaterials = []
    this.contactMaterialTable = new TupleDictionary()
    this.defaultMaterial = new Material("default")
    this.defaultContactMaterial = new ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      { friction: 0.3, restitution: 0.0 }
    )
    this.doProfiling = false
    this.profile = {
      solve: 0,
      makeContactConstraints: 0,
      broadphase: 0,
      integrate: 0,
      narrowphase: 0
    }
    this.accumulator = 0
    this.subsystems = []
    this.addBodyEvent = {
      type: "addBody",
      body: null
    }
    this.removeBodyEvent = {
      type: "removeBody",
      body: null
    }
    this.idToBodyMap = {}
    this.broadphase.setWorld(this)
  }

  getContactMaterial(m1, m2) {
    return this.contactMaterialTable.get(m1.id, m2.id)
  }

  numObjects() {
    return this.bodies.length
  }

  collisionMatrixTick() {
    var temp = this.collisionMatrixPrevious
    this.collisionMatrixPrevious = this.collisionMatrix
    this.collisionMatrix = temp
    this.collisionMatrix.reset()
    this.bodyOverlapKeeper.tick()
    this.shapeOverlapKeeper.tick()
  }

  addBody(body) {
    if (this.bodies.indexOf(body) !== -1) {
      return
    }
    body.index = this.bodies.length
    this.bodies.push(body)
    body.world = this
    body.initPosition.copy(body.position)
    body.initVelocity.copy(body.velocity)
    body.timeLastSleepy = this.time
    if (body instanceof Body) {
      body.initAngularVelocity.copy(body.angularVelocity)
      body.initQuaternion.copy(body.quaternion)
    }
    this.collisionMatrix.setNumObjects(this.bodies.length)
    this.addBodyEvent.body = body
    this.idToBodyMap[body.id] = body
    this.dispatchEvent(this.addBodyEvent)
  }

  addConstraint(c) {
    this.constraints.push(c)
  }

  removeConstraint(c) {
    var idx = this.constraints.indexOf(c)
    if (idx !== -1) {
      this.constraints.splice(idx, 1)
    }
  }

  rayTest(from, to, result) {
    if (result instanceof RaycastResult) {
      this.raycastClosest(
        from,
        to,
        {
          skipBackfaces: true
        },
        result
      )
    } else {
      this.raycastAll(
        from,
        to,
        {
          skipBackfaces: true
        },
        result
      )
    }
  }

  raycastAll(from, to, options, callback) {
    options.mode = Ray.ALL
    options.from = from
    options.to = to
    options.callback = callback
    //@ts-ignore
    return tmpRay.intersectWorld(this, options)
  }

  raycastAny(from, to, options, result) {
    options.mode = Ray.ANY
    options.from = from
    options.to = to
    options.result = result
    //@ts-ignore
    return tmpRay.intersectWorld(this, options)
  }

  raycastClosest(from, to, options, result) {
    options.mode = Ray.CLOSEST
    options.from = from
    options.to = to
    options.result = result
    //@ts-ignore
    return tmpRay.intersectWorld(this, options)
  }

  remove(body) {
    body.world = null
    var n = this.bodies.length - 1,
      bodies = this.bodies,
      idx = bodies.indexOf(body)
    if (idx !== -1) {
      bodies.splice(idx, 1)
      for (var i = 0; i !== bodies.length; i++) {
        bodies[i].index = i
      }
      this.collisionMatrix.setNumObjects(n)
      this.removeBodyEvent.body = body
      delete this.idToBodyMap[body.id]
      this.dispatchEvent(this.removeBodyEvent)
    }
  }

  getBodyById(id) {
    return this.idToBodyMap[id]
  }

  getShapeById(id) {
    var bodies = this.bodies
    for (var i = 0, bl = bodies.length; i < bl; i++) {
      var shapes = bodies[i].shapes
      for (var j = 0, sl = shapes.length; j < sl; j++) {
        var shape = shapes[j]
        if (shape.id === id) {
          return shape
        }
      }
    }
  }

  addMaterial(m) {
    this.materials.push(m)
  }

  addContactMaterial(cmat) {
    this.contactmaterials.push(cmat)
    this.contactMaterialTable.set(
      cmat.materials[0].id,
      cmat.materials[1].id,
      cmat
    )
  }

  step(dt, timeSinceLastCalled, maxSubSteps) {
    maxSubSteps = maxSubSteps || 10
    if (typeof timeSinceLastCalled === "undefined") {
      this.internalStep(dt)
      this.time += dt
    } else {
      this.accumulator += timeSinceLastCalled
      var substeps = 0
      while (this.accumulator >= dt && substeps < maxSubSteps) {
        this.internalStep(dt)
        this.accumulator -= dt
        substeps++
      }
      this.accumulator %= dt
      var t = this.accumulator / dt
      this.interpolationFactor = t
      for (var j = 0; j !== this.bodies.length; j++) {
        var b = this.bodies[j]
        b.previousPosition.lerp(b.position, t, b.interpolatedPosition)
        b.previousQuaternion.slerp(b.quaternion, t, b.interpolatedQuaternion)
        b.previousQuaternion.normalize()
      }
      this.time += timeSinceLastCalled
    }
  }

  internalStep(dt) {
    this.dt = dt
    var world = this,
      that = this,
      contacts = this.contacts,
      p1 = World_step_p1,
      p2 = World_step_p2,
      N = this.numObjects(),
      bodies = this.bodies,
      solver = this.solver,
      gravity = this.gravity,
      doProfiling = this.doProfiling,
      profile = this.profile,
      DYNAMIC = Body.DYNAMIC,
      profilingStart,
      constraints = this.constraints,
      frictionEquationPool = World_step_frictionEquationPool,
      gnorm = gravity.norm(),
      gx = gravity.x,
      gy = gravity.y,
      gz = gravity.z,
      i = 0
    if (doProfiling) {
      profilingStart = performance.now()
    }
    for (i = 0; i !== N; i++) {
      var bi = bodies[i]
      if (bi.type === DYNAMIC) {
        var f = bi.force,
          m = bi.mass
        f.x += m * gx
        f.y += m * gy
        f.z += m * gz
      }
    }
    for (
      var i = 0, Nsubsystems = this.subsystems.length;
      i !== Nsubsystems;
      i++
    ) {
      this.subsystems[i].update()
    }
    if (doProfiling) {
      profilingStart = performance.now()
    }
    p1.length = 0
    p2.length = 0
    this.broadphase.collisionPairs(this, p1, p2)
    if (doProfiling) {
      profile.broadphase = performance.now() - profilingStart
    }
    var Nconstraints = constraints.length
    for (i = 0; i !== Nconstraints; i++) {
      var c = constraints[i]
      if (!c.collideConnected) {
        for (var j = p1.length - 1; j >= 0; j -= 1) {
          if (
            (c.bodyA === p1[j] && c.bodyB === p2[j]) ||
            (c.bodyB === p1[j] && c.bodyA === p2[j])
          ) {
            p1.splice(j, 1)
            p2.splice(j, 1)
          }
        }
      }
    }
    this.collisionMatrixTick()
    if (doProfiling) {
      profilingStart = performance.now()
    }
    var oldcontacts = World_step_oldContacts
    var NoldContacts = contacts.length
    for (i = 0; i !== NoldContacts; i++) {
      oldcontacts.push(contacts[i])
    }
    contacts.length = 0
    var NoldFrictionEquations = this.frictionEquations.length
    for (i = 0; i !== NoldFrictionEquations; i++) {
      frictionEquationPool.push(this.frictionEquations[i])
    }
    this.frictionEquations.length = 0
    this.narrowphase.getContacts(
      p1,
      p2,
      this,
      contacts,
      oldcontacts,
      this.frictionEquations,
      frictionEquationPool
    )
    if (doProfiling) {
      profile.narrowphase = performance.now() - profilingStart
    }
    if (doProfiling) {
      profilingStart = performance.now()
    }
    for (var i = 0; i < this.frictionEquations.length; i++) {
      solver.addEquation(this.frictionEquations[i])
    }
    var ncontacts = contacts.length
    for (var k = 0; k !== ncontacts; k++) {
      var c = contacts[k]
      var bi = c.bi,
        bj = c.bj,
        si = c.si,
        sj = c.sj
      var cm
      if (bi.material && bj.material) {
        cm =
          this.getContactMaterial(bi.material, bj.material) ||
          this.defaultContactMaterial
      } else {
        cm = this.defaultContactMaterial
      }
      var mu = cm.friction
      if (bi.material && bj.material) {
        if (bi.material.friction >= 0 && bj.material.friction >= 0) {
          mu = bi.material.friction * bj.material.friction
        }
        if (bi.material.restitution >= 0 && bj.material.restitution >= 0) {
          c.restitution = bi.material.restitution * bj.material.restitution
        }
      }
      solver.addEquation(c)
      if (
        bi.allowSleep &&
        bi.type === Body.DYNAMIC &&
        bi.sleepState === Body.SLEEPING &&
        bj.sleepState === Body.AWAKE &&
        bj.type !== Body.STATIC
      ) {
        var speedSquaredB = bj.velocity.norm2() + bj.angularVelocity.norm2()
        var speedLimitSquaredB = Math.pow(bj.sleepSpeedLimit, 2)
        if (speedSquaredB >= speedLimitSquaredB * 2) {
          bi._wakeUpAfterNarrowphase = true
        }
      }
      if (
        bj.allowSleep &&
        bj.type === Body.DYNAMIC &&
        bj.sleepState === Body.SLEEPING &&
        bi.sleepState === Body.AWAKE &&
        bi.type !== Body.STATIC
      ) {
        var speedSquaredA = bi.velocity.norm2() + bi.angularVelocity.norm2()
        var speedLimitSquaredA = Math.pow(bi.sleepSpeedLimit, 2)
        if (speedSquaredA >= speedLimitSquaredA * 2) {
          bj._wakeUpAfterNarrowphase = true
        }
      }
      this.collisionMatrix.set(bi, bj, true)
      if (!this.collisionMatrixPrevious.get(bi, bj)) {
        World_step_collideEvent.body = bj
        World_step_collideEvent.contact = c
        bi.dispatchEvent(World_step_collideEvent)
        World_step_collideEvent.body = bi
        bj.dispatchEvent(World_step_collideEvent)
      }
      this.bodyOverlapKeeper.set(bi.id, bj.id)
      this.shapeOverlapKeeper.set(si.id, sj.id)
    }
    this.emitContactEvents()
    if (doProfiling) {
      profile.makeContactConstraints = performance.now() - profilingStart
      profilingStart = performance.now()
    }
    for (i = 0; i !== N; i++) {
      var bi = bodies[i]
      if (bi._wakeUpAfterNarrowphase) {
        bi.wakeUp()
        bi._wakeUpAfterNarrowphase = false
      }
    }
    var Nconstraints = constraints.length
    for (i = 0; i !== Nconstraints; i++) {
      var c = constraints[i]
      c.update()
      for (var j = 0, Neq = c.equations.length; j !== Neq; j++) {
        var eq = c.equations[j]
        solver.addEquation(eq)
      }
    }
    solver.solve(dt, this)
    if (doProfiling) {
      profile.solve = performance.now() - profilingStart
    }
    solver.removeAllEquations()
    var pow = Math.pow
    for (i = 0; i !== N; i++) {
      var bi = bodies[i]
      if (bi.type & DYNAMIC) {
        var ld = pow(clamp01(1.0 - bi.linearDamping), dt)
        var v = bi.velocity
        v.mult(ld, v)
        var av = bi.angularVelocity
        if (av) {
          var ad = pow(clamp01(1.0 - bi.angularDamping), dt)
          av.mult(ad, av)
        }
      }
    }
    this.dispatchEvent(World_step_preStepEvent)
    for (i = 0; i !== N; i++) {
      var bi = bodies[i]
      if (bi.preStep) {
        bi.preStep(bi)
      }
    }
    if (doProfiling) {
      profilingStart = performance.now()
    }
    var stepnumber = this.stepnumber
    var quatNormalize = stepnumber % (this.quatNormalizeSkip + 1) === 0
    var quatNormalizeFast = this.quatNormalizeFast
    for (i = 0; i !== N; i++) {
      bodies[i].integrate(dt, quatNormalize, quatNormalizeFast)
    }
    this.clearForces()
    this.broadphase.dirty = true
    if (doProfiling) {
      profile.integrate = performance.now() - profilingStart
    }
    this.time += dt
    this.stepnumber += 1
    this.dispatchEvent(World_step_postStepEvent)
    for (i = 0; i !== N; i++) {
      var bi = bodies[i]
      var postStep = bi.postStep
      if (postStep) {
        postStep(bi)
      }
    }
    if (this.allowSleep) {
      for (i = 0; i !== N; i++) {
        bodies[i].sleepTick(this.time)
      }
    }
  }

  clearForces() {
    var bodies = this.bodies
    var N = bodies.length
    for (var i = 0; i !== N; i++) {
      var b = bodies[i],
        force = b.force,
        tau = b.torque
      b.force.set(0, 0, 0)
      b.torque.set(0, 0, 0)
    }
  }

  get emitContactEvents() {
    var additions = []
    var removals = []
    var beginContactEvent = {
      type: "beginContact",
      bodyA: null,
      bodyB: null
    }
    var endContactEvent = {
      type: "endContact",
      bodyA: null,
      bodyB: null
    }
    var beginShapeContactEvent = {
      type: "beginShapeContact",
      bodyA: null,
      bodyB: null,
      shapeA: null,
      shapeB: null
    }
    var endShapeContactEvent = {
      type: "endShapeContact",
      bodyA: null,
      bodyB: null,
      shapeA: null,
      shapeB: null
    }
    return function () {
      var hasBeginContact = this.hasAnyEventListener("beginContact")
      var hasEndContact = this.hasAnyEventListener("endContact")
      if (hasBeginContact || hasEndContact) {
        this.bodyOverlapKeeper.getDiff(additions, removals)
      }
      if (hasBeginContact) {
        for (var i = 0, l = additions.length; i < l; i += 2) {
          beginContactEvent.bodyA = this.getBodyById(additions[i])
          beginContactEvent.bodyB = this.getBodyById(additions[i + 1])
          this.dispatchEvent(beginContactEvent)
        }
        beginContactEvent.bodyA = beginContactEvent.bodyB = null
      }
      if (hasEndContact) {
        for (var i = 0, l = removals.length; i < l; i += 2) {
          endContactEvent.bodyA = this.getBodyById(removals[i])
          endContactEvent.bodyB = this.getBodyById(removals[i + 1])
          this.dispatchEvent(endContactEvent)
        }
        endContactEvent.bodyA = endContactEvent.bodyB = null
      }
      additions.length = removals.length = 0
      var hasBeginShapeContact = this.hasAnyEventListener("beginShapeContact")
      var hasEndShapeContact = this.hasAnyEventListener("endShapeContact")
      if (hasBeginShapeContact || hasEndShapeContact) {
        this.shapeOverlapKeeper.getDiff(additions, removals)
      }
      if (hasBeginShapeContact) {
        for (var i = 0, l = additions.length; i < l; i += 2) {
          var shapeA = this.getShapeById(additions[i])
          var shapeB = this.getShapeById(additions[i + 1])
          beginShapeContactEvent.shapeA = shapeA
          beginShapeContactEvent.shapeB = shapeB
          beginShapeContactEvent.bodyA = shapeA.body
          beginShapeContactEvent.bodyB = shapeB.body
          this.dispatchEvent(beginShapeContactEvent)
        }
        beginShapeContactEvent.bodyA =
          beginShapeContactEvent.bodyB =
          beginShapeContactEvent.shapeA =
          beginShapeContactEvent.shapeB =
            null
      }
      if (hasEndShapeContact) {
        for (var i = 0, l = removals.length; i < l; i += 2) {
          var shapeA = this.getShapeById(removals[i])
          var shapeB = this.getShapeById(removals[i + 1])
          if (shapeA && shapeB) {
            endShapeContactEvent.shapeA = shapeA
            endShapeContactEvent.shapeB = shapeB
            endShapeContactEvent.bodyA = shapeA.body
            endShapeContactEvent.bodyB = shapeB.body
            this.dispatchEvent(endShapeContactEvent)
          }
        }
        endShapeContactEvent.bodyA =
          endShapeContactEvent.bodyB =
          endShapeContactEvent.shapeA =
          endShapeContactEvent.shapeB =
            null
      }
    }
  }
}

//@ts-ignore
World.prototype.removeBody = World.prototype.remove
//@ts-ignore
World.prototype.add = World.prototype.addBody



export {
  WheelInfo,
  JacobianElement,
  version,
  AABB,
  ArrayCollisionMatrix,
  Body,
  Box,
  Broadphase,
  Constraint,
  ContactEquation,
  Narrowphase,
  ConeTwistConstraint,
  ContactMaterial,
  ConvexPolyhedron,
  Cylinder,
  DistanceConstraint,
  Equation,
  FrictionEquation,
  GSSolver,
  GridBroadphase,
  Heightfield,
  HingeConstraint,
  LockConstraint,
  Mat3,
  Material,
  NaiveBroadphase,
  ObjectCollisionMatrix,
  Pool,
  Particle,
  Plane,
  PointToPointConstraint,
  Quaternion,
  Ray,
  RaycastVehicle,
  RaycastResult,
  RigidVehicle,
  RotationalEquation,
  RotationalMotorEquation,
  SAPBroadphase,
  SPHSystem,
  Shape,
  Solver,
  Sphere,
  SplitSolver,
  Spring,
  Transform,
  Trimesh,
  Vec3,
  Vec3Pool,
  World
}
