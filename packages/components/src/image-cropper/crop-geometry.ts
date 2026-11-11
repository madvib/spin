/**
 * The crop geometry, vendored: the slice the image-cropper's machine uses.
 *
 * @zag-js/image-cropper, MIT, (c) Zag. The upstream package does not
 * export these utilities, so the pure functions the crop math needs are
 * copied here rather than reached through the package's build output.
 *
 * The vendored slice is the transitive closure of the nine functions the
 * machine imports: no more, no less.
 */

/** A positioned rectangle. */
export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A point in the viewport. */
export interface CropPoint {
  readonly x: number;
  readonly y: number;
}

/** A size. */
export interface CropSize {
  readonly width: number;
  readonly height: number;
}

/** A resize handle's position. */
export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

var { min, max, abs } = Math;

/** A value held between two bounds, NaN folded to the low. */
var clampValue = (v: number, vmin: number, vmax: number): number =>
  min(max(Number.isNaN(v) ? vmin : v, vmin), vmax);


var isLeftHandle = (v: CropHandle | string) =>
  v === "w" || v === "nw" || v === "sw";

var isRightHandle = (v: CropHandle | string) =>
  v === "e" || v === "ne" || v === "se";

var isTopHandle = (v: CropHandle | string) =>
  v === "n" || v === "nw" || v === "ne";

var isBottomHandle = (v: CropHandle | string) =>
  v === "s" || v === "sw" || v === "se";

var isCornerHandle = (v: CropHandle | string) =>
  (isLeftHandle(v) || isRightHandle(v)) &&
  (isTopHandle(v) || isBottomHandle(v));

var isHorizontalEdgeHandle = (v: CropHandle | string) =>
  (isLeftHandle(v) || isRightHandle(v)) &&
  !(isTopHandle(v) || isBottomHandle(v));

var isVerticalEdgeHandle = (v: CropHandle | string) =>
  (isTopHandle(v) || isBottomHandle(v)) &&
  !(isLeftHandle(v) || isRightHandle(v));

var hasAspectRatio = (value: unknown): boolean =>
  typeof value === "number" && value > 0;

var resolveSizeLimits = (options: {
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
  viewportSize: { width: number; height: number };
  aspectRatio: number | null;
}): {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  hasAspect: boolean;
} => {
  // The `hasAspect` gate: the aspect branch only runs when there is one.
  const { minSize, maxSize, viewportSize, aspectRatio } = options;
  let minWidth = min(minSize.width, viewportSize.width);
  let minHeight = min(minSize.height, viewportSize.height);
  let maxWidth = maxSize?.width ?? viewportSize.width;
  if (!Number.isFinite(maxWidth)) maxWidth = viewportSize.width;
  maxWidth = min(maxWidth, viewportSize.width);
  let maxHeight = maxSize?.height ?? viewportSize.height;
  if (!Number.isFinite(maxHeight)) maxHeight = viewportSize.height;
  maxHeight = min(maxHeight, viewportSize.height);
  maxWidth = max(minWidth, maxWidth);
  maxHeight = max(minHeight, maxHeight);
  const hasAspect = hasAspectRatio(aspectRatio);
  if (hasAspect && aspectRatio !== null) {
    const minWidthWithAspect = max(minWidth, minHeight * aspectRatio);
    const minHeightWithAspect = minWidthWithAspect / aspectRatio;
    minWidth = min(minWidthWithAspect, viewportSize.width);
    minHeight = min(minHeightWithAspect, viewportSize.height);
    let constrainedMaxWidth = min(
      maxWidth,
      maxHeight * aspectRatio,
      viewportSize.width,
    );
    let constrainedMaxHeight = constrainedMaxWidth / aspectRatio;
    if (
      constrainedMaxHeight > maxHeight ||
      constrainedMaxHeight > viewportSize.height
    ) {
      constrainedMaxHeight = min(maxHeight, viewportSize.height);
      constrainedMaxWidth = constrainedMaxHeight * aspectRatio;
    }
    maxWidth = max(minWidth, min(constrainedMaxWidth, viewportSize.width));
    maxHeight = max(minHeight, min(constrainedMaxHeight, viewportSize.height));
  } else {
    maxWidth = max(minWidth, min(maxWidth, viewportSize.width));
    maxHeight = max(minHeight, min(maxHeight, viewportSize.height));
  }
  return { minWidth, minHeight, maxWidth, maxHeight, hasAspect };
};

var clampAspectSize = (params: {
  widthValue: number;
  heightValue: number;
  limits: {
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    hasAspect: boolean;
  };
  viewportRect: { width: number; height: number };
  aspectRatio: number;
}): { width: number; height: number } => {
  const { widthValue, heightValue, limits, viewportRect, aspectRatio } = params;
  const { minWidth, minHeight, maxWidth, maxHeight } = limits;
  const constrainWidthFromHeight = (
    height: number,
  ): { width: number; height: number } => {
    let width = clampValue(height * aspectRatio, minWidth, maxWidth);
    width = min(width, viewportRect.width);
    return { width, height: width / aspectRatio };
  };
  const clampByWidth = (value: number): { width: number; height: number } => {
    let width = clampValue(value, minWidth, maxWidth);
    width = min(width, viewportRect.width);
    let height = width / aspectRatio;
    if (height < minHeight) {
      const constrained = constrainWidthFromHeight(minHeight);
      width = constrained.width;
      height = constrained.height;
    }
    if (height > maxHeight) {
      const clampedHeight = min(maxHeight, viewportRect.height);
      const constrained = constrainWidthFromHeight(clampedHeight);
      width = constrained.width;
      height = constrained.height;
    }
    if (height > viewportRect.height) {
      const constrained = constrainWidthFromHeight(viewportRect.height);
      width = constrained.width;
      height = constrained.height;
      if (height < minHeight) {
        const reconstrainted = constrainWidthFromHeight(minHeight);
        width = reconstrainted.width;
        height = reconstrainted.height;
      }
    }
    return { width, height };
  };
  const clampByHeight = (value: number): { width: number; height: number } => {
    let height = clampValue(value, minHeight, maxHeight);
    height = min(height, viewportRect.height);
    let width = height * aspectRatio;
    width = clampValue(width, minWidth, maxWidth);
    width = min(width, viewportRect.width);
    let adjustedHeight = width / aspectRatio;
    if (adjustedHeight < minHeight) {
      const constrained = constrainWidthFromHeight(minHeight);
      width = constrained.width;
      adjustedHeight = constrained.height;
    }
    if (adjustedHeight > maxHeight) {
      const clampedHeight = min(maxHeight, viewportRect.height);
      const constrained = constrainWidthFromHeight(clampedHeight);
      width = constrained.width;
      adjustedHeight = constrained.height;
    }
    if (width > viewportRect.width) {
      width = viewportRect.width;
      adjustedHeight = width / aspectRatio;
      if (adjustedHeight > maxHeight) {
        const clampedHeight = min(maxHeight, viewportRect.height);
        const constrained = constrainWidthFromHeight(clampedHeight);
        width = constrained.width;
        adjustedHeight = constrained.height;
      }
      if (adjustedHeight < minHeight) {
        const constrained = constrainWidthFromHeight(minHeight);
        width = constrained.width;
        adjustedHeight = constrained.height;
      }
    }
    return { width, height: adjustedHeight };
  };
  const byWidth = clampByWidth(widthValue);
  const byHeight = clampByHeight(heightValue);
  const deltaWidth = abs(byWidth.width - widthValue) +
    abs(byWidth.height - heightValue);
  const deltaHeight = abs(byHeight.width - widthValue) +
    abs(byHeight.height - heightValue);
  return deltaHeight < deltaWidth ? byHeight : byWidth;
};

var applyDeltaToEdges = (params: {
  bounds: { left: number; top: number; right: number; bottom: number };
  delta: { x: number; y: number };
  handlePosition: CropHandle | string;
  viewportRect: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
}): { left: number; top: number; right: number; bottom: number } => {
  const { bounds, delta, handlePosition, viewportRect, minSize, maxSize } =
    params;
  let { left, top, right, bottom } = bounds;
  if (isLeftHandle(handlePosition)) {
    const minLeft = max(0, right - maxSize.width);
    const maxLeft = right - minSize.width;
    left = clampValue(left + delta.x, minLeft, maxLeft);
  }
  if (isRightHandle(handlePosition)) {
    const minRight = left + minSize.width;
    const maxRight = min(viewportRect.width, left + maxSize.width);
    right = clampValue(right + delta.x, minRight, maxRight);
  }
  if (isTopHandle(handlePosition)) {
    const minTop = max(0, bottom - maxSize.height);
    const maxTop = bottom - minSize.height;
    top = clampValue(top + delta.y, minTop, maxTop);
  }
  if (isBottomHandle(handlePosition)) {
    const minBottom = top + minSize.height;
    const maxBottom = min(viewportRect.height, top + maxSize.height);
    bottom = clampValue(bottom + delta.y, minBottom, maxBottom);
  }
  return { left, top, right, bottom };
};

var applyAspectToHorizontalResize = (params: {
  bounds: { left: number; top: number; right: number; bottom: number };
  limits: {
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    hasAspect: boolean;
  };
  viewportRect: { width: number; height: number };
  aspectRatio: number;
  handlePosition: CropHandle | string;
}): { left: number; top: number; right: number; bottom: number } => {
  const { bounds, limits, viewportRect, aspectRatio, handlePosition } = params;
  const { left, top, right, bottom } = bounds;
  const centerY = (top + bottom) / 2;
  let nextWidth = right - left;
  let nextHeight = nextWidth / aspectRatio;
  const constrained = clampAspectSize({
    widthValue: nextWidth,
    heightValue: nextHeight,
    limits,
    viewportRect,
    aspectRatio,
  });
  nextWidth = constrained.width;
  nextHeight = constrained.height;
  const halfH = nextHeight / 2;
  let newTop = centerY - halfH;
  let newBottom = centerY + halfH;
  if (newTop < 0) {
    newTop = 0;
    newBottom = nextHeight;
  }
  if (newBottom > viewportRect.height) {
    newBottom = viewportRect.height;
    newTop = newBottom - nextHeight;
  }
  return {
    left: isRightHandle(handlePosition) ? left : right - nextWidth,
    top: newTop,
    right: isRightHandle(handlePosition) ? left + nextWidth : right,
    bottom: newBottom,
  };
};

var applyAspectToVerticalResize = (params: {
  bounds: { left: number; top: number; right: number; bottom: number };
  limits: {
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    hasAspect: boolean;
  };
  viewportRect: { width: number; height: number };
  aspectRatio: number;
  handlePosition: CropHandle | string;
}): { left: number; top: number; right: number; bottom: number } => {
  const { bounds, limits, viewportRect, aspectRatio, handlePosition } = params;
  const { left, top, right, bottom } = bounds;
  const centerX = (left + right) / 2;
  let nextHeight = bottom - top;
  let nextWidth = nextHeight * aspectRatio;
  const constrained = clampAspectSize({
    widthValue: nextWidth,
    heightValue: nextHeight,
    limits,
    viewportRect,
    aspectRatio,
  });
  nextWidth = constrained.width;
  nextHeight = constrained.height;
  const halfW = nextWidth / 2;
  let newLeft = centerX - halfW;
  let newRight = centerX + halfW;
  if (newLeft < 0) {
    newLeft = 0;
    newRight = nextWidth;
  }
  if (newRight > viewportRect.width) {
    newRight = viewportRect.width;
    newLeft = newRight - nextWidth;
  }
  return {
    left: newLeft,
    top: isBottomHandle(handlePosition) ? top : bottom - nextHeight,
    right: newRight,
    bottom: isBottomHandle(handlePosition) ? top + nextHeight : bottom,
  };
};

var applyCornerResize = (params: {
  bounds: { left: number; top: number; right: number; bottom: number };
  width: number;
  height: number;
  handlePosition: CropHandle | string;
}): { left: number; top: number; right: number; bottom: number } => {
  const { bounds, width, height, handlePosition } = params;
  const { left, top, right, bottom } = bounds;
  if (isRightHandle(handlePosition) && isBottomHandle(handlePosition)) {
    return { left, top, right: left + width, bottom: top + height };
  } else if (isRightHandle(handlePosition) && isTopHandle(handlePosition)) {
    return { left, top: bottom - height, right: left + width, bottom };
  } else if (isBottomHandle(handlePosition)) {
    return { left: right - width, top, right, bottom: top + height };
  } else {
    return { left: right - width, top: bottom - height, right, bottom };
  }
};

export function computeResizeCrop(options: {
  cropStart: { x: number; y: number; width: number; height: number };
  handlePosition: CropHandle | string;
  delta: { x: number; y: number };
  viewportRect: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
  aspectRatio: number | null;
}): { x: number; y: number; width: number; height: number } {
  const {
    cropStart,
    handlePosition,
    delta,
    viewportRect,
    minSize,
    maxSize,
    aspectRatio,
  } = options;
  let { x, y, width, height } = cropStart;
  let left = x;
  let top = y;
  let right = x + width;
  let bottom = y + height;
  const { minWidth, minHeight, maxWidth, maxHeight, hasAspect } =
    resolveSizeLimits({
      minSize,
      maxSize,
      viewportSize: viewportRect,
      aspectRatio,
    });
  const edgesAfterDelta = applyDeltaToEdges({
    bounds: { left, top, right, bottom },
    delta,
    handlePosition,
    viewportRect,
    minSize,
    maxSize,
  });
  left = edgesAfterDelta.left;
  top = edgesAfterDelta.top;
  right = edgesAfterDelta.right;
  bottom = edgesAfterDelta.bottom;
  if (hasAspect && aspectRatio !== null) {
    const limits = { minWidth, minHeight, maxWidth, maxHeight, hasAspect };
    if (isCornerHandle(handlePosition)) {
      let tempW = right - left;
      let tempH = tempW / aspectRatio;
      if (
        tempH > bottom - top || top + tempH > viewportRect.height ||
        left + tempW > viewportRect.width
      ) {
        tempH = bottom - top;
        tempW = tempH * aspectRatio;
      }
      const constrained = clampAspectSize({
        widthValue: tempW,
        heightValue: tempH,
        limits,
        viewportRect,
        aspectRatio,
      });
      const result = applyCornerResize({
        bounds: { left, top, right, bottom },
        width: constrained.width,
        height: constrained.height,
        handlePosition,
      });
      left = result.left;
      top = result.top;
      right = result.right;
      bottom = result.bottom;
    } else if (isHorizontalEdgeHandle(handlePosition)) {
      const result = applyAspectToHorizontalResize({
        bounds: { left, top, right, bottom },
        limits,
        viewportRect,
        aspectRatio,
        handlePosition,
      });
      left = result.left;
      top = result.top;
      right = result.right;
      bottom = result.bottom;
    } else if (isVerticalEdgeHandle(handlePosition)) {
      const result = applyAspectToVerticalResize({
        bounds: { left, top, right, bottom },
        limits,
        viewportRect,
        aspectRatio,
        handlePosition,
      });
      left = result.left;
      top = result.top;
      right = result.right;
      bottom = result.bottom;
    }
  }
  const maxLeft = max(0, viewportRect.width - minWidth);
  const maxTop = max(0, viewportRect.height - minHeight);
  left = clampValue(left, 0, maxLeft);
  top = clampValue(top, 0, maxTop);
  const maxRight = min(viewportRect.width, left + maxWidth);
  const maxBottom = min(viewportRect.height, top + maxHeight);
  right = clampValue(right, left + minWidth, maxRight);
  bottom = clampValue(bottom, top + minHeight, maxBottom);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function computeMoveCrop(
  cropStart: { x: number; y: number; width: number; height: number },
  delta: { x: number; y: number },
  viewportRect: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  return {
    x: clampValue(
      cropStart.x + delta.x,
      0,
      viewportRect.width - cropStart.width,
    ),
    y: clampValue(
      cropStart.y + delta.y,
      0,
      viewportRect.height - cropStart.height,
    ),
    width: cropStart.width,
    height: cropStart.height,
  };
}

export var resolveCropAspectRatio = (
  shape: string,
  aspectRatio: number | null,
): number | null => shape === "circle" ? 1 : aspectRatio;

export var getCropSizeLimits = (
  prop: (name: string) => number,
): {
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
} => ({
  minSize: { width: prop("minWidth"), height: prop("minHeight") },
  maxSize: { width: prop("maxWidth"), height: prop("maxHeight") },
});

var DEFAULT_VIEWPORT_FILL = 0.8;

export var computeDefaultCropDimensions = (
  viewportRect: { width: number; height: number },
  aspectRatio: number | null,
  fixedCropArea: boolean,
): { width: number; height: number } => {
  const targetWidth = viewportRect.width * DEFAULT_VIEWPORT_FILL;
  const targetHeight = viewportRect.height * DEFAULT_VIEWPORT_FILL;
  if (typeof aspectRatio === "number" && aspectRatio > 0) {
    if (fixedCropArea) {
      let height2 = viewportRect.height;
      let width2 = height2 * aspectRatio;
      if (width2 > viewportRect.width) {
        width2 = viewportRect.width;
        height2 = width2 / aspectRatio;
      }
      return { width: width2, height: height2 };
    }
    const targetAspect = targetWidth / targetHeight;
    if (aspectRatio > targetAspect) {
      const width2 = targetWidth;
      const height2 = width2 / aspectRatio;
      return { width: width2, height: height2 };
    }
    const height = targetHeight;
    const width = height * aspectRatio;
    return { width, height };
  }
  if (fixedCropArea) {
    const size = min(viewportRect.width, viewportRect.height);
    return { width: size, height: size };
  }
  return { width: targetWidth, height: targetHeight };
};

export var isVisibleRect = (rect: { width: number; height: number }): boolean =>
  rect.width > 0 && rect.height > 0;

export var centerRect = (
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { x: number; y: number } => ({
  x: max(0, (viewport.width - size.width) / 2),
  y: max(0, (viewport.height - size.height) / 2),
});

export var getMaxBounds = (
  cropSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
): { x: number; y: number } => ({
  x: max(0, viewportSize.width - cropSize.width),
  y: max(0, viewportSize.height - cropSize.height),
});


export var clampPoint = (
  point: { x: number; y: number },
  min2: { x: number; y: number },
  max2: { x: number; y: number },
): { x: number; y: number } => ({
  x: clampValue(point.x, min2.x, max2.x),
  y: clampValue(point.y, min2.y, max2.y),
});
