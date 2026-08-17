#version 300 es
precision highp float;
precision highp int;

in vec3 a_position;
in vec3 a_normal;
in vec4 a_instanceRect;
in vec2 a_instanceIntensity;

out vec3 v_normal;
out float v_intensity;
out float v_parentIntensity;
out vec3 v_position;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform vec2 u_resolution;
uniform float u_baseZ;
uniform int u_viewMode;
uniform float u_intensityMultiplier;
uniform float u_clamp;

void main() {
  float x = a_instanceRect.x;
  float y = a_instanceRect.y;
  float w = a_instanceRect.z;
  float h = a_instanceRect.w;

  float intensity = a_instanceIntensity.x;

  if (u_viewMode == 1) {
    intensity = a_instanceIntensity.x - a_instanceIntensity.y;
  }

  if (u_viewMode == 0) {
    intensity *= u_intensityMultiplier * 0.5;
  } else {
    intensity *= u_intensityMultiplier;
  }
  intensity = max(u_clamp, intensity);

  float depth = intensity * 100.0;

  vec3 pos = a_position;
  pos.x = x + pos.x * w - u_resolution.x * 0.5;
  pos.y = y + pos.y * h - u_resolution.y * 0.5;
  pos.z = pos.z * depth;

  gl_Position = u_projection * u_view * vec4(pos, 1.0);

  v_normal = mat3(u_view) * a_normal;
  v_intensity = a_instanceIntensity.x;
  v_parentIntensity = a_instanceIntensity.y;
  v_position = pos;
}
