import type { DriverType, ShaderUniformValue } from '../drivers/types';

export type WorkerMessageType =
  | 'INIT'
  | 'init'
  | 'RESIZE'
  | 'resize'
  | 'UNIFORM_UPDATE'
  | 'SET_UNIFORMS'
  | 'uniforms'
  | 'POINTER_MOVE'
  | 'POINTER_LEAVE'
  | 'TIME'
  | 'time'
  | 'PAUSE'
  | 'pause'
  | 'RESUME'
  | 'resume'
  | 'SET_VISIBILITY'
  | 'VISIBILITY'
  | 'DESTROY'
  | 'destroy'
  | 'INIT_ACK'
  | 'READY'
  | 'ERROR';

export interface WorkerInitMessage {
  type: 'INIT' | 'init';
  canvas: OffscreenCanvas;
  width?: number;
  height?: number;
  dpr?: number;
  driver?: DriverType;
  glsl?: string;
  wgsl?: string;
  uniforms?: Record<string, ShaderUniformValue | any>;
}

export interface WorkerResizeMessage {
  type: 'RESIZE' | 'resize';
  width: number;
  height: number;
  dpr: number;
}

export interface WorkerUniformUpdateMessage {
  type: 'UNIFORM_UPDATE';
  name: string;
  value: any;
}

export interface WorkerSetUniformsMessage {
  type: 'SET_UNIFORMS' | 'uniforms';
  uniforms: Record<string, ShaderUniformValue | any>;
}

export interface WorkerPointerMoveMessage {
  type: 'POINTER_MOVE';
  x: number;
  y: number;
}

export interface WorkerPointerLeaveMessage {
  type: 'POINTER_LEAVE';
}

export interface WorkerTimeMessage {
  type: 'TIME' | 'time';
  time: number;
}

export interface WorkerVisibilityMessage {
  type: 'SET_VISIBILITY' | 'VISIBILITY';
  visible: boolean;
}

export interface WorkerPauseMessage {
  type: 'PAUSE' | 'pause';
}

export interface WorkerResumeMessage {
  type: 'RESUME' | 'resume';
}

export interface WorkerDestroyMessage {
  type: 'DESTROY' | 'destroy';
}

export interface WorkerReadyMessage {
  type: 'READY' | 'INIT_ACK';
  driver?: DriverType;
  success?: boolean;
}

export interface WorkerErrorMessage {
  type: 'ERROR';
  message: string;
}
