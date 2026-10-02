import * as THREE from './vendor/three.module.js';
const base=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
export function sphereAttitude(geometry,calibration){
 const q=new THREE.Quaternion();const r=geometry?.geographicRotation;
 if(r){const m=new THREE.Matrix4().set(r[0][0],r[0][1],r[0][2],0,r[1][0],r[1][1],r[1][2],0,r[2][0],r[2][1],r[2][2],0,0,0,0,1);q.setFromRotationMatrix(m)}else q.setFromAxisAngle(new THREE.Vector3(0,1,0),-(geometry?.headingOffset||0)*Math.PI/180);
 q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-(geometry?.geographicYawCorrection||0)*Math.PI/180));
 const correction=new THREE.Quaternion().setFromEuler(new THREE.Euler(calibration.pitch*Math.PI/180,-calibration.yaw*Math.PI/180,0,'YXZ'));
 return correction.multiply(q).multiply(base);
}
