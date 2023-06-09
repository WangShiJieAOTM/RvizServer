// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { FoxgloveMessages } from "@foxglove/studio-base/types/FoxgloveMessages";
import { CameraInfo, DistortionModel } from "@foxglove/studio-base/types/Messages";

export const CALIBRATION_DATATYPES = [
  // ROS well-known
  "sensor_msgs/CameraInfo",
  "sensor_msgs/msg/CameraInfo",
  // Foxglove schemas (ros and proto variants)
  "foxglove_msgs/CameraCalibration",
  "foxglove_msgs/msg/CameraCalibration",
  "foxglove.CameraCalibration",
] as const;

export function normalizeCameraInfo(message: unknown, datatype: string): CameraInfo | undefined {
  // Cast to the union of all supported datatypes to ensure we handle all cases
  switch (datatype as (typeof CALIBRATION_DATATYPES)[number]) {
    case "sensor_msgs/CameraInfo":
    case "sensor_msgs/msg/CameraInfo":
      return message as CameraInfo;
    case "foxglove_msgs/CameraCalibration":
    case "foxglove_msgs/msg/CameraCalibration":
    case "foxglove.CameraCalibration": {
      const typedMessage = message as FoxgloveMessages["foxglove.CameraCalibration"];
      // prettier-ignore
      const mat3Identity = [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ];
      // prettier-ignore
      const mat4Identity = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
      ];
      return {
        width: typedMessage.width,
        height: typedMessage.height,
        distortion_model: (typedMessage.distortion_model ?? "") as DistortionModel,
        D: typedMessage.D ?? [],
        K: typedMessage.K ?? mat3Identity,
        R: typedMessage.R ?? mat3Identity,
        P: typedMessage.P ?? mat4Identity,
        binning_x: 1,
        binning_y: 1,
        roi: { x_offset: 0, y_offset: 0, width: 0, height: 0, do_rectify: false },
      };
    }
  }

  return undefined;
}
