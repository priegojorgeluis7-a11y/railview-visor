import * as THREE from './vendor/three.module.js';
// Compute spherical coordinates per fragment. Interpolating the mesh's UVs
// makes the triangles at the nadir drag distant texture columns into a star.
export function panoramaMaterial(geometry={},map=null){
 const {haov=360,vaov=180,vOffset=0}=geometry;
 const rad=Math.PI/180;
 const crop=new THREE.Vector4((180-haov/2)*rad,haov*rad,(90-vOffset-vaov/2)*rad,vaov*rad);
 const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false});
 material.onBeforeCompile=shader=>{
  shader.uniforms.panoramaCrop={value:crop};
  shader.vertexShader='varying vec3 panoramaDirection;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npanoramaDirection = position;');
  shader.fragmentShader='varying vec3 panoramaDirection;\nuniform vec4 panoramaCrop;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    vec3 direction = normalize(panoramaDirection);
    float longitude = mod(atan(direction.z, direction.x) + 6.28318530718, 6.28318530718);
    float colatitude = acos(clamp(direction.y, -1.0, 1.0));
    vec2 panoramaUV = vec2((longitude-panoramaCrop.x)/panoramaCrop.y, 1.0-(colatitude-panoramaCrop.z)/panoramaCrop.w);
    diffuseColor *= texture2D(map, panoramaUV);
   #endif
  `);
 };
 material.customProgramCacheKey=()=> 'railview-spherical-fragment-v1';
 return material;
}
