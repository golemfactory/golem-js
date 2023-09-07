export function getBlenderParams(frame: number) {
  return {
    scene_file: "/golem/resource/scene.blend",
    resolution: [400, 300],
    use_compositing: false,
    crops: [
      {
        outfilebasename: "out",
        borders_x: [0.0, 1.0],
        borders_y: [0.0, 1.0],
      },
    ],
    samples: 100,
    frames: [frame],
    output_format: "PNG",
    RESOURCES_DIR: "/golem/resources",
    WORK_DIR: "/golem/work",
    OUTPUT_DIR: "/golem/output",
  };
}
