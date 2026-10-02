// Only complete captures with a reconstructed nadir and a verified geographic
// heading enter the route. Source photographs remain available for repair.
export function isViewable(s){
 const g=s.geometry,fit=g?.headingCalibration;
 return !s.partial&&s.frameCount>=26&&g?.nadirNormalized===true&&g.haov>=359&&g.vaov>=110&&Array.isArray(g.geographicRotation)&&g.geographicRotation.length===3&&!!fit&&Number.isFinite(fit.yawDegrees)&&Number.isFinite(fit.heldOutResidualDegrees)&&fit.heldOutResidualDegrees<=.16&&fit.inliers>=15;
}
