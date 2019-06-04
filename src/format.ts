'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';
import { Buffer } from 'buffer';
import { getEdits } from './diffUtils';

export class Formatter {
  private format(data: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const bin = 'jsonnetfmt';
      // This uses the Google internal config per https://github.com/google/jsonnet/issues/359.
      const args = ['--indent', '2', '--max-blank-lines', '2', '--sort-imports', '--string-style', 's', '--comment-style', 's', '-'];
      let p = cp.spawn(bin, args);
      let stdout_: Buffer[] = [];
      let stderr_: Buffer[] = [];
      p.stdout.on('data', chunk => stdout_.push(chunk as Buffer));
      p.stderr.on('data', chunk => stderr_.push(chunk as Buffer));
      p.on('close', (code, signal) => {
        if (code != 0) {
          reject(new Error(`Non-zero exit value ${code}: ${Buffer.concat(stderr_).toString()}`));
          return;
        }
        resolve(Buffer.concat(stdout_).toString());
      });
      p.on('error', reject);
      p.stdin.end(data);
    });
  }

  public async getFormatEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    let oldCode = document.getText();
    let newCode = await this.format(oldCode);
    let filePatch = getEdits(document.fileName, oldCode, newCode);
    return filePatch.edits.map(edit => edit.apply());
  }
}

export class JsonnetDocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
  private formatter: Formatter;
  constructor() {
    this.formatter = new Formatter();
  }
  public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
    return this.formatter.getFormatEdits(document);
  }
}
