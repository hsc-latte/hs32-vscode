import * as vscode from 'vscode';

function _(a: string, b: string, c: string) {
    let instr = new vscode.CompletionItem(a, vscode.CompletionItemKind.Method);
    instr.documentation = new vscode.MarkdownString(b, true);
	instr.detail = c;
    instr.kind = vscode.CompletionItemKind.Method;
    return instr;
}

const branch = [
    [ 'eq', 'Z', 'equal/zero' ],
    [ 'ne', '!Z', 'not equal/not zero' ],
    [ 'cs', 'C', 'carry set' ],
    [ 'nc', '!C', 'no carry' ],
    [ 'ss', 'N', 'sign set/negative' ],
    [ 'ns', '!N', 'no sign/positive' ],
    [ 'ov', 'V', 'overflow' ],
    [ 'nv', '!V', 'no overflow' ],
    [ 'ab', 'C & !Z', 'unsigned above' ],
    [ 'be', '!C | Z', 'unsigned below or equal' ],
    [ 'ge', '!(N^V)', 'signed >=' ],
    [ 'lt', 'N^V', 'signed <' ],
    [ 'gt', '!Z & !(N^V)', 'signed >' ],
    [ 'le', 'Z | (N^V)', 'signed <=' ],
];

const op: {[id:string]:string} = {
    ['ADD']: ' +', ['SUB']: ' -', ['MUL']: ' *',
    ['AND']: ' &', ['OR']:  ' |', ['XOR']: ' ^'
};

///////////////////////////////////////////////////////////////////////////////

export const instrDocs = [
    _('LDR', 'LDR Rd, [Rm + Rn/imm]',   'Loads value from memory at address into register.'),
    _('STR', 'STR Rd, [Rm + Rn/imm]',   'Stores value from register into memory at address.'),
    _('MOV', 'MOV Rd, Rn/imm',          'Moves data between registers.'),
    _('ADD', 'ADD Rd, Rm, Rn/imm',      'Performs addition.'),
    _('ADDC', 'ADDC Rd, Rm, Rn/imm',    'Performs addition + carry.'),
    _('SUB', 'SUB Rd, Rm, Rn/imm',      'Performs subtraction with Rm as minuend.'),
    _('SUBC', 'SUBC Rd, Rm, Rn/imm',    'Performs subtraction with Rm as minuend - carry.'),
    _('RSUB', 'RSUB Rd, Rm, Rn/imm',    'Performs subtraction with Rm as subtrahend.'),
    _('RSUBC', 'RSUBC Rd, Rm, Rn/imm',  'Performs subtraction with Rm as subtrahend - carry.'),
    _('MUL', 'MUL Rd, Rm, Rn/imm',      'Performs unsigned multiplication.'),
    _('AND', 'AND Rd, Rm, Rn/imm',      'Performs bitwise AND.'),
    _('OR', 'OR Rd, Rm, Rn/imm',        'Performs bitwise OR.'),
    _('BIC', 'BIC Rd, Rm, Rn/imm',      'Clears the bits in Rn/imm from Rm.'),
    _('XOR', 'XOR Rd, Rm, Rn/imm',      'Performs bitwise XOR.'),
    _('CMP', 'CMP Rm, Rn/imm',          'Performs subtraction with Rm as minuend, discarding the result.'),
    _('TST', 'TST Rm, Rn/imm',          'Performs bitwise AND, discarding the result.')
].concat((() => {
    let a: vscode.CompletionItem[] = [];
    branch.forEach(x => {
        const instr = `B${x[0].toUpperCase()}`;
        const desc = `Branch if ${x[2]} to PC+imm. Checks flag: ${x[1]}.`;
        a.push(_(instr, instr + ' imm', desc));
    });
    branch.forEach(x => {
        const instr = `B${x[0].toUpperCase()}L`;
        const desc = `Branch if ${x[2]} to PC+imm, then set LR to return address. Checks flag: ${x[1]}.`;
        a.push(_(instr, instr + ' imm', desc));
    });
    return a;
})());

// TODO: Refactor

export function getSignaturesALU(instr: string) : vscode.SignatureInformation[] {
    let sign1 = new vscode.SignatureInformation(
        `${instr} Rd${op[instr] !== undefined ? ' <-' : ','} Rm${op[instr] !== undefined ? op[instr] : ','} Rn`,
        'Operate on Rm and Rn, placing the result in Rd');
    sign1.parameters = [
        new vscode.ParameterInformation('Rd', 'Destination register'),
        new vscode.ParameterInformation('Rm', 'First operand register'),
        new vscode.ParameterInformation('Rn', 'Second operand register'),
    ];

    let sign2 = new vscode.SignatureInformation(
        `${instr} Rd ${op[instr] !== undefined ? '<-' : ','} Rm ${op[instr] !== undefined ? op[instr] : ','} imm`,
        'Operate on Rm and an immediate value, placing the result in Rd');
    sign2.parameters = [
        new vscode.ParameterInformation('Rd', 'Destination register'),
        new vscode.ParameterInformation('Rm', 'First operand register'),
        new vscode.ParameterInformation('imm', 'Second operand (16-bit immediate value)'),
    ];
    return [ sign1, sign2 ];
}

export function getSignaturesLDR() : vscode.SignatureInformation[] {
    let sign1 = new vscode.SignatureInformation(
        `LDR Rd <- [Rm + sh(Rn)]`,
        'Loads the value at address Rm + sh(Rn) into Rd');
    sign1.parameters = [
        new vscode.ParameterInformation('Rd', 'Destination register'),
        new vscode.ParameterInformation('Rm', 'Address base register'),
        new vscode.ParameterInformation('sh(Rn)', 'Address offset register'),
    ];

    let sign2 = new vscode.SignatureInformation(
        `LDR Rd <- [Rm + imm]`,
        'Loads the value at address Rm + imm into Rd');
    sign2.parameters = [
        new vscode.ParameterInformation('Rd', 'Destination register'),
        new vscode.ParameterInformation('Rm', 'Address base register'),
        new vscode.ParameterInformation('imm', 'Address offset (16-bit immediate value)'),
    ];
    return [ sign1, sign2 ];
}

export function getSignaturesSTR() : vscode.SignatureInformation[] {
    let sign1 = new vscode.SignatureInformation(
        `STR [Rm + sh(Rn)] <- Rd`,
        'Stores the value in Rd to address Rm + sh(Rn)');
    sign1.parameters = [
        new vscode.ParameterInformation('Rm', 'Address base register'),
        new vscode.ParameterInformation('sh(Rn)', 'Address offset register'),
        new vscode.ParameterInformation('Rd', 'Destination register')
    ];

    let sign2 = new vscode.SignatureInformation(
        `STR [Rm + imm] <- Rd`,
        'Stores the value in Rd to address Rm + imm');
    sign2.parameters = [
        new vscode.ParameterInformation('Rm', 'Address base register'),
        new vscode.ParameterInformation('imm', 'Address offset (16-bit immediate value)'),
        new vscode.ParameterInformation('Rd', 'Destination register')
    ];
    return [ sign1, sign2 ];
}

export function getSignaturesMOV() : vscode.SignatureInformation[] {
    let sign1 = new vscode.SignatureInformation(
        `MOV Rd, sh(Rn)`,
        'Move the value from Rn to Rd');
    sign1.parameters = [
        new vscode.ParameterInformation('Rd', 'Destination register'),
        new vscode.ParameterInformation('Rn', 'Source register'),
    ];

    let sign2 = new vscode.SignatureInformation(
        `MOV Rd, imm`,
        'Move the immediate value specified to Rd');
    sign2.parameters = [
        new vscode.ParameterInformation('Rd', 'Destination register'),
        new vscode.ParameterInformation('imm', 'Source 16-bit immediate value'),
    ];
    return [ sign1, sign2 ];
}

export function getSignaturesCMP() : vscode.SignatureInformation[] {
    let sign1 = new vscode.SignatureInformation(
        `CMP Rm, sh(Rn)`,
        'Compares Rm and Rn');
    sign1.parameters = [
        new vscode.ParameterInformation('Rm', 'Minuend in comparison'),
        new vscode.ParameterInformation('Rn', 'Subtrahend in comparison'),
    ];

    let sign2 = new vscode.SignatureInformation(
        `CMP Rm, imm`,
        'Compares Rm and imm');
    sign2.parameters = [
        new vscode.ParameterInformation('Rm', 'Minuend in comparison'),
        new vscode.ParameterInformation('imm', '16-bit immediate subtrahend'),
    ];
    return [ sign1, sign2 ];
}

export function getSignaturesTST() : vscode.SignatureInformation[] {
    let sign1 = new vscode.SignatureInformation(
        `TST Rm, sh(Rn)`,
        'Tests bit set in Rm from Rn mask');
    sign1.parameters = [
        new vscode.ParameterInformation('Rm', 'Register 1'),
        new vscode.ParameterInformation('Rn', 'Register 2'),
    ];

    let sign2 = new vscode.SignatureInformation(
        `TST Rm, imm`,
        'Tests bit set in Rm from imm mask');
    sign2.parameters = [
        new vscode.ParameterInformation('Rm', 'Register 1'),
        new vscode.ParameterInformation('imm', '16-bit immediate value'),
    ];
    return [ sign1, sign2 ];
}
