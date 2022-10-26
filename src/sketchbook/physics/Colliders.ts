import { CANNON } from "sketchbook/physics"
import { threeToCannon } from "./three-to-cannon"
import * as THREE from "three"
import { Object3D, Vector3 } from "three"
import * as Utils from "sketchbook/core/FunctionLibrary"

export interface ICollider {
  body: CANNON.Body

  // physical: CANNON.Body;
  // visual: THREE.Mesh;

  // getVisualModel(options: any): THREE.Mesh;
}

export class BoxCollider implements ICollider {
  public options: any
  public body: CANNON.Body
  public debugModel: THREE.Mesh

  constructor(options: any) {
    let defaults = {
      mass: 0,
      position: new THREE.Vector3(),
      size: new THREE.Vector3(0.3, 0.3, 0.3),
      friction: 0.3
    }
    options = Utils.setDefaults(options, defaults)
    this.options = options

    options.position = new CANNON.Vec3(
      options.position.x,
      options.position.y,
      options.position.z
    )
    options.size = new CANNON.Vec3(
      options.size.x,
      options.size.y,
      options.size.z
    )

    let mat = new CANNON.Material("boxMat")
    mat.friction = options.friction
    // mat.restitution = 0.7;

    let shape = new CANNON.Box(options.size)
    // shape.material = mat;

    // Add phys sphere
    let physBox = new CANNON.Body({
      mass: options.mass,
      position: options.position,
      shape
    })

    physBox.material = mat

    this.body = physBox
  }
}

export class CapsuleCollider implements ICollider {
  public options: any
  public body: CANNON.Body
  // public visual: THREE.Mesh;

  constructor(options: any) {
    let defaults = {
      mass: 0,
      position: new CANNON.Vec3(),
      height: 0.5,
      radius: 0.3,
      segments: 8,
      friction: 0.3
    }
    options = Utils.setDefaults(options, defaults)
    this.options = options

    let mat = new CANNON.Material("capsuleMat")
    mat.friction = options.friction

    let capsuleBody = new CANNON.Body({
      mass: options.mass,
      position: options.position
    })

    // Compound shape
    let sphereShape = new CANNON.Sphere(options.radius)

    // Materials
    capsuleBody.material = mat
    // sphereShape.material = mat;

    capsuleBody.addShape(sphereShape, new CANNON.Vec3(0, 0, 0))
    capsuleBody.addShape(sphereShape, new CANNON.Vec3(0, options.height / 2, 0))
    capsuleBody.addShape(
      sphereShape,
      new CANNON.Vec3(0, -options.height / 2, 0)
    )

    this.body = capsuleBody
  }
}
export class ConvexCollider implements ICollider {
  public mesh: any
  public options: any
  public body: CANNON.Body
  public debugModel: any

  constructor(mesh: Object3D, options: any) {
    this.mesh = mesh.clone()

    let defaults = {
      mass: 0,
      position: mesh.position,
      friction: 0.3
    }
    options = Utils.setDefaults(options, defaults)
    this.options = options

    let mat = new CANNON.Material("convMat")
    mat.friction = options.friction
    // mat.restitution = 0.7;

    if (this.mesh.geometry.isBufferGeometry) {
      this.mesh.geometry = new THREE.Geometry().fromBufferGeometry(
        this.mesh.geometry
      )
    }

    let cannonPoints = this.mesh.geometry.vertices.map((v: Vector3) => {
      return new CANNON.Vec3(v.x, v.y, v.z)
    })

    let cannonFaces = this.mesh.geometry.faces.map((f: any) => {
      return [f.a, f.b, f.c]
    })


    let shape = new CANNON.ConvexPolyhedron({vertices: cannonPoints, faces: cannonFaces})

    //let shape = new CANNON.ConvexPolyhedron(cannonPoints, cannonFaces)
    
    // shape.material = mat;

    // Add phys sphere
    let physBox = new CANNON.Body({
      mass: options.mass,
      position: options.position,
      shape
    })

    physBox.material = mat

    this.body = physBox
  }
}

export class SphereCollider implements ICollider {
  public options: any
  public body: CANNON.Body
  public debugModel: THREE.Mesh

  constructor(options: any) {
    let defaults = {
      mass: 0,
      position: new CANNON.Vec3(),
      radius: 0.3,
      friction: 0.3
    }
    options = Utils.setDefaults(options, defaults)
    this.options = options

    let mat = new CANNON.Material("sphereMat")
    mat.friction = options.friction

    let shape = new CANNON.Sphere(options.radius)
    // shape.material = mat;

    // Add phys sphere
    let physSphere = new CANNON.Body({
      mass: options.mass,
      position: options.position,
      shape
    })
    physSphere.material = mat

    this.body = physSphere
  }
}

export class TrimeshCollider implements ICollider {
  public mesh: any
  public options: any
  public body: CANNON.Body
  public debugModel: any

  constructor(mesh: Object3D, options: any) {
    this.mesh = mesh.clone()

    let defaults = {
      mass: 0,
      position: mesh.position,
      rotation: mesh.quaternion,
      friction: 0.3
    }
    options = Utils.setDefaults(options, defaults)
    this.options = options

    let mat = new CANNON.Material("triMat")
    mat.friction = options.friction
    // mat.restitution = 0.7;

    let shape = threeToCannon(this.mesh, { type: threeToCannon.Type.MESH })
    // shape['material'] = mat;

    // Add phys sphere
    let physBox = new CANNON.Body({
      mass: options.mass,
      position: options.position,
      quaternion: options.rotation,
      shape: shape
    })

    physBox.material = mat

    this.body = physBox
  }
}
