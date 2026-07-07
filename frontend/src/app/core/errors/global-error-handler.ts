import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const originalError = this._findOriginalError(error as any);
    const message = this._extractMessage(error);
    const stack = this._extractStack(error);

    console.error('[GlobalErrorHandler] Angular Error');
    console.error('[GlobalErrorHandler] Message:', message);
    console.error('[GlobalErrorHandler] Full Error Object:', error);

    if (stack) {
      console.error('[GlobalErrorHandler] Stack:', stack);
    }

    if (originalError) {
      console.error('[GlobalErrorHandler] Original Error Source:', originalError);
      const originalStack = this._extractStack(originalError);
      if (originalStack) {
        console.error('[GlobalErrorHandler] Original Stack:', originalStack);
      }
    }
  }

  private _findOriginalError(error: any): any {
    if (!error) {
      return null;
    }

    if (error.originalError) {
      return error.originalError;
    }

    if (error.rejection) {
      return error.rejection;
    }

    if (error.error) {
      return error.error;
    }

    return null;
  }

  private _extractMessage(error: any): string {
    if (!error) {
      return 'No error details provided';
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message || error.toString();
    }

    if (typeof error?.message === 'string') {
      return error.message;
    }

    return String(error);
  }

  private _extractStack(error: any): string | undefined {
    if (!error) {
      return undefined;
    }

    if (error instanceof Error) {
      return error.stack;
    }

    if (typeof error?.stack === 'string') {
      return error.stack;
    }

    return undefined;
  }
}
