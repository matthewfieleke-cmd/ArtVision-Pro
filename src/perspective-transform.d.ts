declare module 'perspective-transform' {
  type Transform = {
    transform: (x: number, y: number) => [number, number];
    inverse: () => Transform;
  };

  export default function PerspectiveTransform(
    src: number[],
    dst: number[]
  ): Transform;
}
