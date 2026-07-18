/** Media library feature module — Phase 13, extended Phase 18 */
export { MediaLibraryPage } from "./components/media-library-page";
export {
  loadMediaFiles,
  addMediaFile,
  updateMediaFile,
  deleteMediaFiles,
  bulkMoveMediaToFolder,
  countMediaUsage,
  getMediaUsageDetails,
  getMediaStats,
  MEDIA_UPDATED_EVENT,
} from "./lib/media-repository";
export {
  loadMediaFolders,
  createMediaFolder,
  UPLOADS_FOLDER_ID,
} from "./lib/media-folders";
