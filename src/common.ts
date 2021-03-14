import { Range } from "vscode";

export interface TokenRule {
    type: string,
    regex: RegExp
};

export interface Token {
    type: string,
    value: any,
    range: Range
}

export interface SyntaxRule {
    type: string,
    rule: string[],
    parse: (x: Token[]) => any
};
