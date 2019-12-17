'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';
import { Buffer } from 'buffer';
import { getEdits } from './diffUtils';

export class Formatter {
  private makeFormatterFlags(options: vscode.FormattingOptions): string[] {
    let extConfig = vscode.workspace.getConfiguration('jsonnet-formatter');
    return [
      '--indent', extConfig.indent == 0 ? options.tabSize : extConfig.indent,
      '--max-blank-lines', extConfig.maxBlankLines,
      '--string-style', extConfig.stringStyle[0],
      '--comment-style', extConfig.commentStyle[0],
      extConfig.prettyFieldNames ? '--pretty-field-names' : '--no-pretty-field-names',
      extConfig.padArrays ? '--pad-arrays' : '--no-sort-imports',
      extConfig.padObjects ? '--pad-objects' : '--no-sort-imports',
      extConfig.sortImports ? '--sort-imports' : '--no-sort-imports',
      '-'
    ];
  }

  private format(data: string, options: vscode.FormattingOptions): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const bin = 'jsonnetfmt';
      // This uses the Google internal config per https://github.com/google/jsonnet/issues/359.
      const args = this.makeFormatterFlags(options);
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

  public async getFormatEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): Promise<vscode.TextEdit[]> {
    let oldCode = document.getText();
    let newCode = await this.format(oldCode, options);
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
    return this.formatter.getFormatEdits(document, options);
  }
}
