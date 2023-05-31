// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { t } from "i18next";
import * as THREE from "three";

import { PinholeCameraModel } from "@foxglove/den/image";
import { ImageAnnotations as FoxgloveImageAnnotations } from "@foxglove/schemas";
import { Immutable, MessageEvent, SettingsTreeAction, Topic } from "@foxglove/studio";
import { Annotation } from "@foxglove/studio-base/panels/Image/types";
import {
  NamespacedTopic,
  namespaceTopic,
} from "@foxglove/studio-base/panels/ThreeDeeRender/namespaceTopic";
import {
  ImageMarker as RosImageMarker,
  ImageMarkerArray as RosImageMarkerArray,
} from "@foxglove/studio-base/types/Messages";
import { LabelPool } from "@foxglove/three-text";

import { RenderableTopicAnnotations } from "./RenderableTopicAnnotations";
import { AnyRendererSubscription, ImageModeConfig } from "../../../IRenderer";
import { SettingsTreeEntry } from "../../../SettingsManager";
import { IMAGE_ANNOTATIONS_DATATYPES } from "../../../foxglove";
import { IMAGE_MARKER_ARRAY_DATATYPES, IMAGE_MARKER_DATATYPES } from "../../../ros";
import { topicIsConvertibleToSchema } from "../../../topicIsConvertibleToSchema";
import { sortPrefixMatchesToFront } from "../../Images/topicPrefixMatching";
import { MessageHandler, MessageRenderState } from "../MessageHandler";

interface ImageAnnotationsContext {
  initialScale: number;
  initialCanvasWidth: number;
  initialCanvasHeight: number;
  initialPixelRatio: number;
  topics(): readonly Topic[];
  config(): Immutable<ImageModeConfig>;
  updateConfig(updateHandler: (draft: ImageModeConfig) => void): void;
  updateSettingsTree(): void;
  labelPool: LabelPool;
  messageHandler: MessageHandler;
}

const ALL_SUPPORTED_SCHEMAS = new Set([
  ...IMAGE_ANNOTATIONS_DATATYPES,
  ...IMAGE_MARKER_DATATYPES,
  ...IMAGE_MARKER_ARRAY_DATATYPES,
]);

/**
 * This class handles settings and rendering for ImageAnnotations/ImageMarkers.
 */
export class ImageAnnotations extends THREE.Object3D {
  readonly #context: ImageAnnotationsContext;
  readonly #renderablesByNamespacedTopic = new Map<NamespacedTopic, RenderableTopicAnnotations>();

  #cameraModel?: PinholeCameraModel;
  #scale: number;
  #canvasWidth: number;
  #canvasHeight: number;
  #pixelRatio: number;

  public constructor(context: ImageAnnotationsContext) {
    super();
    this.#context = context;
    this.#scale = context.initialScale;
    this.#canvasWidth = context.initialCanvasWidth;
    this.#canvasHeight = context.initialCanvasHeight;
    this.#pixelRatio = context.initialPixelRatio;
    context.messageHandler.addListener(this.#updateFromMessageState);
  }

  public getSubscriptions(): readonly AnyRendererSubscription[] {
    return [
      {
        type: "schema",
        schemaNames: ALL_SUPPORTED_SCHEMAS,
        subscription: { handler: this.#context.messageHandler.handleAnnotations },
      },
    ];
  }

  public dispose(): void {
    for (const renderable of this.#renderablesByNamespacedTopic.values()) {
      renderable.dispose();
    }
    this.children.length = 0;
    this.#renderablesByNamespacedTopic.clear();
  }

  /** Called when seeking or a new data source is loaded.  */
  public removeAllRenderables(): void {
    for (const renderable of this.#renderablesByNamespacedTopic.values()) {
      renderable.dispose();
      this.remove(renderable);
    }
    this.#renderablesByNamespacedTopic.clear();
  }

  public updateScale(
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
    pixelRatio: number,
  ): void {
    this.#scale = scale;
    this.#canvasWidth = canvasWidth;
    this.#canvasHeight = canvasHeight;
    this.#pixelRatio = pixelRatio;
    for (const renderable of this.#renderablesByNamespacedTopic.values()) {
      renderable.setScale(scale, canvasWidth, canvasHeight, pixelRatio);
      renderable.update();
    }
  }

  public updateCameraModel(cameraModel: PinholeCameraModel): void {
    this.#cameraModel = cameraModel;
    for (const renderable of this.#renderablesByNamespacedTopic.values()) {
      renderable.setCameraModel(cameraModel);
      renderable.update();
    }
  }

  #updateFromMessageState = (newState: MessageRenderState) => {
    if (newState.annotationsByTopicSchema != undefined) {
      for (const { originalMessage, annotations } of newState.annotationsByTopicSchema.values()) {
        this.#handleMessage(originalMessage, annotations);
      }
    }
  };

  #handleMessage(
    messageEvent: MessageEvent<FoxgloveImageAnnotations | RosImageMarker | RosImageMarkerArray>,
    annotations: Annotation[],
  ) {
    const topic = namespaceTopic(messageEvent.topic, messageEvent.schemaName);
    let renderable = this.#renderablesByNamespacedTopic.get(topic);
    if (!renderable) {
      renderable = new RenderableTopicAnnotations(topic, this.#context.labelPool);
      renderable.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
      renderable.setCameraModel(this.#cameraModel);
      this.#renderablesByNamespacedTopic.set(topic, renderable);
      this.add(renderable);
    }

    renderable.setOriginalMessage(messageEvent.message);
    renderable.setAnnotations(annotations);
    renderable.update();
  }

  #handleSettingsAction(
    topic: Topic,
    convertTo: string | undefined,
    action: SettingsTreeAction,
  ): void {
    if (action.action !== "update" || action.payload.path.length < 2) {
      return;
    }
    const { value } = action.payload;
    if (
      action.payload.path[0] === "imageAnnotations" &&
      action.payload.path[2] === "visible" &&
      typeof value === "boolean"
    ) {
      this.#handleTopicVisibilityChange(topic, convertTo, value);
    }
    this.#context.updateSettingsTree();
  }

  #handleTopicVisibilityChange(
    topic: Topic,
    convertTo: string | undefined,
    visible: boolean, // eslint-disable-line @foxglove/no-boolean-parameters
  ): void {
    const namespacedTopic = namespaceTopic(topic.name, convertTo ?? topic.schemaName);
    this.#context.updateConfig((draft) => {
      const annotations = (draft.annotations ??= {});
      let settings = annotations[namespacedTopic];
      if (settings) {
        settings.visible = visible;
      } else {
        settings = {
          visible,
        };
        annotations[namespacedTopic] = settings;
      }
    });
    this.#context.messageHandler.setConfig({
      annotations: this.#context.config().annotations,
    } as Readonly<Partial<ImageModeConfig>>);
    const renderable = this.#renderablesByNamespacedTopic.get(namespacedTopic);
    if (renderable) {
      renderable.visible = visible;
    }
  }

  public settingsNodes(): SettingsTreeEntry[] {
    const entries: SettingsTreeEntry[] = [];

    entries.push({
      path: ["imageAnnotations"],
      node: {
        label: t("threeDee:imageAnnotations"),
        enableVisibilityFilter: true,
        defaultExpansionState: "expanded",
      },
    });
    const config = this.#context.config();

    const annotationTopics = this.#context
      .topics()
      .filter((topic) => topicIsConvertibleToSchema(topic, ALL_SUPPORTED_SCHEMAS));

    // Sort annotation topics with prefixes matching the image topic to the top.
    if (config.imageTopic) {
      sortPrefixMatchesToFront(annotationTopics, config.imageTopic, (topic) => topic.name);
    }

    const addEntry = (topic: Topic, convertTo: string | undefined) => {
      const schemaName = convertTo ?? topic.schemaName;
      if (!ALL_SUPPORTED_SCHEMAS.has(schemaName)) {
        return;
      }
      const namespacedTopic = namespaceTopic(topic.name, schemaName);
      const settings = config.annotations?.[namespacedTopic];
      entries.push({
        path: ["imageAnnotations", namespacedTopic],
        node: {
          label: topic.name,
          visible: settings?.visible ?? false,
          handler: this.#handleSettingsAction.bind(this, topic, convertTo),
        },
      });
    };
    for (const topic of annotationTopics) {
      addEntry(topic, undefined);
      for (const convertTo of topic.convertibleTo ?? []) {
        addEntry(topic, convertTo);
      }
    }
    return entries;
  }
}
