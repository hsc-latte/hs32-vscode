import { Location, Position, Range } from 'vscode';
import { SyntaxRule, Token, TokenRule } from './common';

const tokenrules : TokenRule[] = [
    { type: "SPACE",    regex: /\s+/ },
    { type: "SHIFT",    regex: /(shr|shl|ror|shx)/ },
    { type: "(",        regex: /\(/ },
    { type: ")",        regex: /\)/ },
    { type: "[",        regex: /\[/ },
    { type: "]",        regex: /\]/ },
    { type: ",",        regex: /(?:,|<-)/ },
    { type: ":",        regex: /:/ },
    
    // Operators
    { type: "OPL",      regex: /(&|\||\*|\^)/ },
    { type: "OP",       regex: /(\+|-)/ },

    { type: "STR",      regex: /(["'])((?:\\.|[^\\])*?)\1/ },
    { type: "LIT_HEX",  regex: /(?:0x|0X)([A-Fa-f0-9_]+)/ },
    { type: "LIT_HEX",  regex: /([A-Fa-f0-9_]+)(?:h|H)/ },
    { type: "LIT_BIN",  regex: /(?:0b|0B)([01_]+)/ },
    { type: "LIT_BIN",  regex: /([01_]+)(?:b|B)/ },
    { type: "LIT_DEC",  regex: /([0-9]+)/ },
    { type: "REG",      regex: /(r\d{1,2}|pc|lr)/i },
    { type: "IDENT",    regex: /([A-Za-z0-9_]+)/ },
];

// Reduction rules (combining multiple tokens)
const syntaxrules : SyntaxRule[] = [
    { type: "NUM",      rule: [ 'LIT_HEX' ],                    parse: x => x },
    { type: "NUM",      rule: [ 'LIT_DEC' ],                    parse: x => x },
    { type: "NUM",      rule: [ 'LIT_BIN' ],                    parse: x => x },
    
    { type: "LABEL",    rule: [ 'IDENT',':' ],                  parse: x => x },
    { type: "SHREG",    rule: [ 'REG','SHIFT','NUM' ],          parse: x => x },
    
    /*{ type: "OFFSETR",  rule: [ '[','REG','OP','SHREG',']' ],   parse: x => x },
    { type: "OFFSETR",  rule: [ '[','REG','OP','REG',']' ],     parse: x => x },
    { type: "PTRR",     rule: [ '[','REG',']' ],                parse: x => x },
    { type: "PTRR",     rule: [ 'OFFSETR' ],                    parse: x => x },

    { type: "OFFSETI",  rule: [ '[','REG','OP','NUM',']' ],     parse: x => x },
    { type: "OFFSETI",  rule: [ '[','REG','OP','IDENT',']' ],   parse: x => x },
    { type: "PTRI",     rule: [ 'OFFSETI' ],                    parse: x => x },
    { type: "PTRI",     rule: [ '[','IDENT',']' ],              parse: x => x },
    { type: "PTRI",     rule: [ '[','NUM',']' ],                parse: x => x },
    { type: "PTRI",     rule: [ '[','OP','NUM',']' ],           parse: x => x }*/
];

// Brute force match and reduce once, returning reduced array + status
function matchsyntax(tokens : Token[]) {
    let hasMatch = false;
    for(let i = 0; i < syntaxrules.length; i++) {
        const rule    = syntaxrules[i].rule;
        const parsefn = syntaxrules[i].parse;

        // Given rule, find matching token sequence
        // Then combine tokens using the reduction rule

        for(let j = 0; j + rule.length-1 < tokens.length; j++) {
            if(rule.reduce((a, v, k) => a && tokens[j+k].type === v, true)) {
                const raw = tokens.slice(j, j+rule.length);
                const value = parsefn ? parsefn(raw) : raw;
                tokens.splice(j, rule.length, {
                    type: syntaxrules[i].type,
                    value: value,
                    range: tokens[j].range
                });
                hasMatch = true;
                break;
            }
        }
    }
    return { a: hasMatch, b: tokens };
}

// A simple tokenize and reduce function
export function tokenize1(input: string, lineno: number): Token[] {
    let line = input;
    let hasMatch = true;
    let tokens : Token[] = [];
    let start = 0;
    while(hasMatch) {
        hasMatch = false;
        for(let i = 0; i < tokenrules.length; i++) {
            const match = line.match(tokenrules[i].regex);
            if(match && match.length > 0 && match.index === 0) {
                line = line.substr(match[0].length);
                hasMatch = true;
                if(!tokenrules[i].type.match(/SPACE|\[|\]/)) {
                    tokens.push({
                        type: tokenrules[i].type,
                        value: tokenrules[i].type === "STR" ? match[2] : match[1],
                        range: new Range(
                            new Position(lineno, match.index + start),
                            new Position(lineno, match.index + start + match[0].length)
                        )
                    });
                }
                start += match[0].length;
                break;
            }
        }
        // Continue until we have no more matches
    }
    if(line !== "") {
        return tokens;
    }
    // Try matching and reducing now
    hasMatch = true;
    while(hasMatch) {
        const tmp = matchsyntax(tokens);
        hasMatch = tmp.a, tokens = tmp.b;
    }
    return tokens;
}

// Tokenize and remove labels (to get instruction)
export function tokenize(input: string) : Token[] {
    let tokens = tokenize1(input, 0);
    if(!tokens || tokens.length === 0) {
        return [];
    }
    while(tokens[0] && tokens[0].type === "LABEL") {
        tokens.splice(0, 1);
    }
    if(!tokens || tokens.length === 0) {
        return [];
    }
    // Bestow upon the first token, the title of INSTR
    tokens[0].type = 'INSTR';
    return tokens;
}

export function getAllSymbols(input: string) {
    let symb = [ { name: '_start', range: new Range(new Position(0, 0), new  Position(0, 0)) } ];
    input.split(/\r?\n/).forEach((x, i) => {
        let tokens = tokenize1(x, i);
        while(tokens[0] && tokens[0].type === "LABEL") {
            symb.push({ name: tokens[0].value, range: tokens[0].range });
            tokens.splice(0, 1);
        }
    });
    return symb;
}

// Sees if the type of tokens matches exactly with arr
// ['A', ['B', 'C']] will match sequence A, (B or C)
export function matchToken(tokens: Token[], arr: (string | string[])[]) {
    return  arr.reduce((a, v, i) => {
        if(typeof v !== 'string') {
            return a && v.reduce((a1, c) => a1 || tokens[i]?.type === c, false);
        } else {
            return a && tokens[i]?.type === v;
        }
    }, true);
}
