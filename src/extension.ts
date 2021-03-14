import * as vscode from 'vscode';
import * as isa from './isa';
import { Token } from './common';
import { tokenize, getAllSymbols, tokenize1 } from './tokenizer';

class HsCompletionProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
		const line = document.lineAt(position).text.substr(0, position.character).trimStart();
		const tokens = tokenize(line);
		if(!line.endsWith(' ') && tokens.length <= 1) {
			return isa.instrDocs;
		} else {
			let res: vscode.CompletionItem[] = [];
			{
				let sp = new vscode.CompletionItem('sp');
				sp.detail = 'Stack pointer';
				sp.kind = vscode.CompletionItemKind.Variable;
				res.push(sp);
				let lr = new vscode.CompletionItem('lr');
				lr.kind = vscode.CompletionItemKind.Variable;
				lr.detail = 'Link register';
				res.push(lr);
				let pc = new vscode.CompletionItem('pc');
				pc.detail = 'Program counter';
				pc.kind = vscode.CompletionItemKind.Variable;
				res.push(pc);
			}
			for(var i = 0; i < 13; i++) {
				let reg = new vscode.CompletionItem(`r${i}`);
				reg.detail = 'General purpose register';
				reg.kind = vscode.CompletionItemKind.Variable;
				res.push(reg);
			}
			getAllSymbols(document.getText()).forEach(x => {
				let s = new vscode.CompletionItem(x.name);
				s.detail = 'Symbol';
				s.kind = vscode.CompletionItemKind.Enum;
				res.push(s);
			});
			return res;
		}

		/*let res: vscode.CompletionItem[] = [];
		for(var i = 0; i <= 26; i++) {
			let a1 = new vscode.CompletionItem('a' + i);
		    a1.kind = i;
			res.push(a1);
		}
		return res;*/
	}
}

const nullPosition = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

class HsSignatureHelpProvider implements vscode.SignatureHelpProvider {
	private countArguments(tokens: Token[]) {
		let n = 0;
		let tok: Token = { type: '', value: '', range: nullPosition };
		tokens.forEach(x => {
			if(x.type.match(/[\(\)\[\]\,\:]|OPL?/)) {
				n++;
			} else {
				tok = x;
			}
		});
		console.log(n);
		return { arg: n, tok: tok };
	}

	private createHelper(
		tokens: Token[], arity: number, imm: number, signatures: vscode.SignatureInformation[]
	) {
		let helper = new vscode.SignatureHelp();
		const { arg, tok } = this.countArguments(tokens.slice(1,));
		helper.signatures = signatures;
		helper.activeSignature = (arg === imm && tok.type.match(/SHREG|REG/)) ? 0 : 1;
		helper.activeParameter = Math.max(0, Math.min(arg, arity-1));
		
		console.log(tokens);
		console.log(arg);
		
		return helper;
	}

	provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position) {
		const line = document.lineAt(position).text;
		const tokens = tokenize(line);
		if(tokens.length > 0  && tokens[0].type === 'INSTR') {
			const instr = <string> tokens[0].value;
			if(instr.match(/(addc?|r?subc?|and|bic|x?or)/i)) {
				return this.createHelper(
					tokens, 3, 2, isa.getSignaturesALU(instr.toUpperCase())
				);
			}
			else if(instr.match(/ldr/i)) {
				return this.createHelper(tokens, 3, 2, isa.getSignaturesLDR());
			}
			else if(instr.match(/str/i)) {
				return this.createHelper(tokens, 3, 1, isa.getSignaturesSTR());
			}
			else if(instr.match(/mov/i)) {
				return this.createHelper(tokens, 2, 1, isa.getSignaturesMOV());
			}
			else if(instr.match(/cmp/i)) {
				return this.createHelper(tokens, 2, 1, isa.getSignaturesCMP());
			}
			else if(instr.match(/tst/i)) {
				return this.createHelper(tokens, 2, 1, isa.getSignaturesTST());
			}
		}
		return undefined;
	}
}

class HsSymbolProvider implements vscode.DocumentSymbolProvider {
	provideDocumentSymbols(document: vscode.TextDocument) {
		let res: vscode.SymbolInformation[] = [];
		getAllSymbols(document.getText()).forEach(x => {
			let sym = new vscode.SymbolInformation(
				x.name, vscode.SymbolKind.Function, '', new vscode.Location(document.uri, x.range)
			);
			res.push(sym);
		});
		return res;
	}
}

class HsDefinitionProvider implements vscode.DefinitionProvider {
	provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
		const line = document.lineAt(position).text;
		const tokens = tokenize1(line, 0);
		const symbs = getAllSymbols(document.getText());
		for(var i = 0; i < tokens.length; i++) {
			const x = tokens[i];
			if(position.character >= x.range.start.character && position.character <= x.range.end.character) {
				for(var j = 0; j < symbs.length; j++) {
					if(symbs[j].name === x.value) {
						return new vscode.Location(document.uri, symbs[j].range);
					}
				}
			}
		}
		return undefined;
	}
}

export function activate(context: vscode.ExtensionContext) {
	const completion = vscode.languages.registerCompletionItemProvider(
		'hs32asm', new HsCompletionProvider(), ''
	);
	const signature = vscode.languages.registerSignatureHelpProvider(
		'hs32asm', new HsSignatureHelpProvider(), ' ',
	);
	const symbol = vscode.languages.registerDocumentSymbolProvider(
		'hs32asm', new HsSymbolProvider()
	);
	const definition = vscode.languages.registerDefinitionProvider(
		'hs32asm', new HsDefinitionProvider()
	);
	context.subscriptions.push(completion, signature, symbol, definition);
}

export function deactivate() { }
