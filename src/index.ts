export { EppClient } from './core/EppClient';
export {
  EppCommandError,
  EppConnectionError,
  EppError,
  EppProtocolError,
  EppTimeoutError,
  EppValidationError,
} from './core/Errors';
export { DEFAULT_MAX_FRAME_SIZE, encodeFrame, FrameDecoder } from './core/Framing';
export { DEFAULT_OBJECT_URIS, NS, SUPPORTED_EXTENSION_URIS } from './core/Namespaces';
export { redactXml } from './core/Redact';
export { VERSION } from './core/Version';
export { parseXml, XmlNode } from './xml/XmlReader';
export { el, serializeXml } from './xml/XmlWriter';
export type { XmlAttributeValue, XmlChild, XmlElement } from './xml/XmlWriter';
export * from './types';
export * from './utils/Helpers';
