// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TFunction } from "i18next";

import { SettingsTreeNodes } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";

export function buildSettingsTree(
  topicToRender: string,
  availableTopics: Topic[],
  t: TFunction<"log">,
): SettingsTreeNodes {
  const topicOptions = availableTopics.map((topic) => ({ label: topic.name, value: topic.name }));
  const topicIsAvailable = availableTopics.some((topic) => topic.name === topicToRender);
  if (!topicIsAvailable) {
    topicOptions.unshift({ value: topicToRender, label: topicToRender });
  }
  const topicError = topicIsAvailable ? undefined : t("topicError", { topic: topicToRender });

  return {
    general: {
      fields: {
        topicToRender: {
          input: "select",
          label: t("topic"),
          value: topicToRender,
          error: topicError,
          options: topicOptions,
        },
      },
    },
  };
}
