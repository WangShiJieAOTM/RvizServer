// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { merge } from "hammerjs";
import { Immutable as Im } from "immer";
import { cloneDeep } from "lodash";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { DeepPartial } from "ts-essentials";

import { Topic } from "@foxglove/studio";
import { ImageModeConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/IRenderer";
import { LegacyImageConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/Renderer";
import {
  CameraState,
  DEFAULT_CAMERA_STATE,
} from "@foxglove/studio-base/panels/ThreeDeeRender/camera";
import { LayerSettingsTransform } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/FrameAxes";
import { DEFAULT_PUBLISH_SETTINGS } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/PublishSettings";

import { AnyRendererConfig, RendererConfig, migrateConfigTopicsNodes } from "./config";

export function useMigratedThreeDeeConfig(
  initialState: undefined | DeepPartial<AnyRendererConfig>,
  topics: undefined | Im<Topic[]>,
): [Im<RendererConfig>, Dispatch<SetStateAction<Im<RendererConfig>>>] {
  const [initialTopics] = useState(topics);

  const [config, setConfig] = useState<Im<RendererConfig>>(() => {
    const partialConfig: DeepPartial<RendererConfig> = initialState ?? {};

    // Initialize the camera from default settings overlaid with persisted settings
    const cameraState: CameraState = merge(
      cloneDeep(DEFAULT_CAMERA_STATE),
      partialConfig.cameraState ?? {},
    );
    const publish = merge(cloneDeep(DEFAULT_PUBLISH_SETTINGS), partialConfig.publish ?? {});

    const transforms = (partialConfig.transforms ?? {}) as Record<
      string,
      Partial<LayerSettingsTransform>
    >;

    // Merge in config from the legacy Image panel
    const legacyImageConfig = partialConfig as DeepPartial<LegacyImageConfig> | undefined;
    const imageMode: ImageModeConfig = {
      imageTopic: legacyImageConfig?.cameraTopic,
      ...partialConfig.imageMode,
      annotations: partialConfig.imageMode?.annotations as
        | ImageModeConfig["annotations"]
        | undefined,
    };

    const completeConfig: RendererConfig = {
      version: "2",
      cameraState,
      followMode: partialConfig.followMode ?? "follow-pose",
      followTf: partialConfig.followTf,
      imageMode,
      layers: partialConfig.layers ?? {},
      publish,
      scene: partialConfig.scene ?? {},
      namespacedTopics: partialConfig.namespacedTopics ?? {},
      topics: partialConfig.topics ?? {},
      transforms,
    };

    return migrateConfigTopicsNodes(completeConfig, topics ?? []);
  });

  useEffect(() => {
    if (topics !== initialTopics) {
      setConfig((old) => migrateConfigTopicsNodes(old, topics ?? []));
    }
  }, [initialTopics, topics]);

  return [config, setConfig];
}
