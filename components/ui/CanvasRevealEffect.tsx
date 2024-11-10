"use client";

import { cn } from "@/lib/utils";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, { useMemo, useRef } from "react";
import * as THREE from "three";

export const CanvasRevealEffect = ({
  animationSpeed = 0.4,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[0, 255, 255]],
  containerClassName,
  dotSize,
  showGradient = true,
}: {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
}) => {
  return (
    <div className={cn("h-full relative bg-white w-full", containerClassName)}>
      <div className="h-full w-full">
        <DotMatrix
          colors={colors}
          dotSize={dotSize ?? 3}
          opacities={opacities}
          shader={`float animation_speed_factor = ${animationSpeed.toFixed(
            1
          )};
          float intro_offset = distance(u_resolution / 2.0 / u_total_size, st2) * 0.01 + (random(st2) * 0.15);
          opacity *= step(intro_offset, u_time * animation_speed_factor);
          opacity *= clamp((1.0 - step(intro_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
        `}
          center={["x", "y"]}
        />
      </div>
      {showGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-[84%]" />
      )}
    </div>
  );
};

interface DotMatrixProps {
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ("x" | "y")[];
}

const DotMatrix: React.FC<DotMatrixProps> = ({
  colors = [[0, 0, 0]],
  opacities = [0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 4,
  dotSize = 2,
  center = ["x", "y"],
}) => {
  const uniforms = useMemo(() => {
    const colorsArray = Array(6)
      .fill(colors[0])
      .map((_, i) => colors[Math.floor(i / 2)] || colors[0]);

    return {
      u_colors: {
        value: colorsArray.map((color) =>
          color.map((component) => component / 255)
        ),
      },
      u_opacities: {
        value: opacities,
      },
      u_total_size: {
        value: totalSize,
      },
      u_dot_size: {
        value: dotSize,
      },
    };
  }, [colors, opacities, totalSize, dotSize]);

  return (
    <Shader
      source={`precision mediump float;
        in vec2 fragCoord;
        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) {
          return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
        }

        void main() {
          vec2 st = fragCoord.xy;
          ${
            center.includes("x")
              ? "st.x -= mod(u_resolution.x, u_total_size) * 0.5;"
              : ""
          }
          ${
            center.includes("y")
              ? "st.y -= mod(u_resolution.y, u_total_size) * 0.5;"
              : ""
          }

          vec2 grid = floor(st / u_total_size);
          float opacity = step(0.0, st.x) * step(0.0, st.y);
          float rand = random(grid + floor(u_time * 5.0));
          opacity *= u_opacities[int(rand * 10.0)];
          opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
          opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

          vec3 color = u_colors[int(rand * 6.0)];
          fragColor = vec4(color, opacity);
          fragColor.rgb *= fragColor.a;
        }
      `}
      uniforms={uniforms}
    />
  );
};

const Shader: React.FC<ShaderProps> = ({ source, uniforms }) => {
  return (
    <Canvas className="absolute inset-0 h-full w-full">
      <ShaderMaterial source={source} uniforms={uniforms} />
    </Canvas>
  );
};

interface ShaderProps {
  source: string;
  uniforms: {
    [key: string]: {
      value: number | number[] | THREE.Vector2 | THREE.Vector3 | number[][];
    };
  };
}

const ShaderMaterial: React.FC<ShaderProps> = ({ source, uniforms }) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        precision mediump float;
        in vec3 position;
        out vec2 fragCoord;

        void main() {
          gl_Position = vec4(position, 1.0);
          fragCoord = position.xy;
        }
      `,
      fragmentShader: source,
      uniforms: {
        ...uniforms,
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(size.width, size.height) },
      },
    });
  }, [source, size, uniforms]);

  useFrame(({ clock }) => {
    if (ref.current?.material instanceof THREE.ShaderMaterial) {
      ref.current.material.uniforms.u_time.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={ref}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};
