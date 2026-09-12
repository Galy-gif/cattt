#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// Original-material skyline, detected once in Swift. A single continuous boundary
// keeps ALL cloud pixels in the sky and ALL mountain pixels in the ridge plane.
static float skylineY(float x, device const float *boundary, float count) {
    float index=clamp(x,0.0f,1.0f)*(count-1.0f);
    uint lo=uint(floor(index));
    uint hi=min(lo+1,uint(count)-1);
    return mix(boundary[lo],boundary[hi],fract(index));
}
static half skyCoverage(float2 position, float2 size, device const float *boundary, float count) {
    float edge=skylineY(position.x/size.x,boundary,count);
    return half(1.0f-smoothstep(edge-0.0008f,edge+0.0008f,position.y/size.y));
}

[[ stitchable ]] half4 courtyardSky(float2 position, SwiftUI::Layer layer, float2 size,
                                    device const float *boundary, float count) {
    half4 original=layer.sample(position);
    half coverage=skyCoverage(position,size,boundary,count);
    // Existing cloud-free sky texture fills the small strip revealed behind hills.
    float fillY=size.y*(0.08f+0.035f*fract(position.y/(size.y*0.15f)));
    half4 fill=layer.sample(float2(position.x,fillY));
    return mix(fill,original,coverage);
}

[[ stitchable ]] half4 courtyardRidge(float2 position, half4 color, float2 size,
                                      device const float *boundary, float count) {
    return color*(1.0h-skyCoverage(position,size,boundary,count));
}
