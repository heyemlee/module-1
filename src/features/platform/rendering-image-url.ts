export const RENDERING_IMAGE_PIXEL_VERSION = "1536x1024";

export function renderingImageUrl(projectId: string, renderingId: string) {
  return `/api/projects/${projectId}/round1/renderings/${renderingId}/image?px=${RENDERING_IMAGE_PIXEL_VERSION}`;
}
