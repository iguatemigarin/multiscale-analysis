#version 300 es
precision highp float;
precision highp int;

in vec3 v_normal;
in float v_intensity;
in float v_parentIntensity;
in vec3 v_position;

out vec4 outColor;

uniform int u_viewMode; // 0 = average; 1 = parentAvg
uniform int u_colorMode;
uniform float u_intensityMultiplier;
uniform float u_clamp;
uniform vec3 u_lightDir;

vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h / 60.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  vec3 rgb;
  if (hp < 1.0) rgb = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb = vec3(0.0, c, x);
  else if (hp < 4.0) rgb = vec3(0.0, x, c);
  else if (hp < 5.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  float m = l - c / 2.0;
  return rgb + m;
}

void main() {
  float intensity = v_intensity;

  if (u_viewMode == 1) {
    intensity = v_intensity - v_parentIntensity;
  }

  if (u_viewMode == 0) {
    intensity *= u_intensityMultiplier * 0.5;
  } else {
    intensity *= u_intensityMultiplier;
  }

  intensity = max(u_clamp, intensity);

  vec3 color;
  if (u_colorMode == 0) {
    float mono = intensity * 100.0 / 255.0;
    color = vec3(mono);
  } else {
    float hue = intensity * 200.0;
    color = hsl2rgb(mod(hue, 360.0), 0.5, 0.5);
  }

  vec3 normal = normalize(v_normal);
  float diffuse = max(dot(normal, normalize(u_lightDir)), 0.0);
  float ambient = 0.3;
  float lighting = ambient + diffuse * 0.7;

  color *= lighting;

  outColor = vec4(color, 1.0);
}
