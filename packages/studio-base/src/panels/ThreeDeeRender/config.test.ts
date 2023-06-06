// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Topic } from "@foxglove/studio";
import { DEFAULT_CAMERA_STATE } from "@foxglove/studio-base/panels/ThreeDeeRender/camera";
import { DEFAULT_PUBLISH_SETTINGS } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/PublishSettings";
import {
  URDF_PARAM_KEY,
  URDF_TOPIC_NAME,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Urdfs";

import { RendererConfig, migrateConfigTopicsNodes } from "./config";

// Jest doesn't support ES module imports fully yet, so we need to mock the wasm file
jest.mock("three/examples/jsm/libs/draco/draco_decoder.wasm", () => "");

describe("migrateConfigTopicNodes", () => {
  it("migrates topics", () => {
    const oldConfig: RendererConfig = {
      cameraState: DEFAULT_CAMERA_STATE,
      followMode: "follow-pose",
      followTf: undefined,
      imageMode: {},
      layers: {},
      namespacedTopics: {},
      publish: DEFAULT_PUBLISH_SETTINGS,
      scene: {},
      topics: {
        topic_a: {},
        topic_b: {},
        topic_c: {},
        [URDF_PARAM_KEY]: {},
        [URDF_TOPIC_NAME]: {},
      },
      transforms: {},
      version: "2",
    };

    const topics: Topic[] = [
      { name: "topic_a", schemaName: "foxglove.Grid", datatype: "datatype_a" },
      {
        name: "topic_c",
        schemaName: "unsupported.Schema",
        datatype: "datatype_a",
        convertibleTo: ["foxglove.RawImage"],
      },
    ];

    const migrated = migrateConfigTopicsNodes(oldConfig, topics);
    expect(migrated).toMatchObject({
      namespacedTopics: {
        "topic_a:foxglove.Grid": {},
        "topic_c:foxglove.RawImage": {},
        [URDF_PARAM_KEY]: {},
        [URDF_TOPIC_NAME]: {},
      },
      topics: {
        topic_b: {},
      },
    });
  });
});
