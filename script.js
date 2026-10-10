// Switch between Playground and Documentation views
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));

    if (viewName === 'playground') {
        document.getElementById('playground-view').classList.add('active');
        document.getElementById('nav-playground').classList.add('active');
    } else if (viewName === 'docs') {
        document.getElementById('docs-view').classList.add('active');
        document.getElementById('nav-docs').classList.add('active');
    }
}

// Clear the spell output console
function clearConsole() {
    document.getElementById('output').textContent = 'Ready to cast spells...';
}

// Cast and Run with strict two-pass validation (Prevents partial execution on syntax errors)
function runCode() {
    const code = document.getElementById('codeEditor').value;
    const outputEl = document.getElementById('output');
    
    outputEl.textContent = '✨ Casting spell...\n';

    try {
        // Pass 1: Strict Syntax & Structure Validation
        validateAuraLangSyntax(code);

        // Pass 2: Execution (Only runs if code is 100% syntactically valid)
        interpretAuraLang(code, outputEl);
        outputEl.textContent += '\n✨ Spell executed successfully!';
    } catch (error) {
        outputEl.textContent += `\nTraceback (most recent call last):\n  File "spellbook.aura", line ${error.line || 'unknown'}\n${error.name || 'ArcaneError'}: ${error.message}`;
    }
}

// Pass 1: Comprehensive Syntax Validation
function validateAuraLangSyntax(code) {
    const lines = code.split('\n');
    let hasSummon = false;
    let hasBanish = false;
    let braceStack = [];
    let inBody = false;

    for (let i = 0; i < lines.length; i++) {
        let rawLine = lines[i];
        let trimmed = rawLine.trim();
        let lineNum = i + 1;

        if (!trimmed || trimmed.startsWith('//')) continue;

        // Check brackets, braces, and parentheses balance
        for (let char of trimmed) {
            if (char === '{') braceStack.push({ type: '{', line: lineNum });
            if (char === '(') braceStack.push({ type: '(', line: lineNum });
            if (char === '[') braceStack.push({ type: '[', line: lineNum });
            
            if (char === '}') {
                let last = braceStack.pop();
                if (!last || last.type !== '{') {
                    let err = new Error("Unmatched closing brace '}'.");
                    err.name = "SyntaxError";
                    err.line = lineNum;
                    throw err;
                }
            }
            if (char === ')') {
                let last = braceStack.pop();
                if (!last || last.type !== '(') {
                    let err = new Error("Unmatched closing parenthesis ')'.");
                    err.name = "SyntaxError";
                    err.line = lineNum;
                    throw err;
                }
            }
            if (char === ']') {
                let last = braceStack.pop();
                if (!last || last.type !== '[') {
                    let err = new Error("Unmatched closing bracket ']'.");
                    err.name = "SyntaxError";
                    err.line = lineNum;
                    throw err;
                }
            }
        }

        if (trimmed === 'summon') {
            if (hasSummon) {
                let err = new Error("Redundant 'summon' entrypoint found.");
                err.name = "SyntaxError";
                err.line = lineNum;
                throw err;
            }
            hasSummon = true;
            inBody = true;
            continue;
        }
        
        if (trimmed === 'banish') {
            if (!hasSummon) {
                let err = new Error("'banish' called without an active 'summon' block.");
                err.name = "SyntaxError";
                err.line = lineNum;
                throw err;
            }
            hasBanish = true;
            inBody = false;
            continue;
        }

        if (inBody) {
            const isBlockOpener = trimmed.startsWith('ritual') || trimmed.startsWith('prophecy') || trimmed.startsWith('oracle');
            const isOnlyBrace = trimmed === '{' || trimmed === '}';
            
            // Enforce semicolon presence on executable statements
            if (!isBlockOpener && !isOnlyBrace) {
                if (!trimmed.endsWith(';')) {
                    let err = new Error("Missing semicolon ';' at the end of statement.");
                    err.name = "SyntaxError";
                    err.line = lineNum;
                    throw err;
                }
            }

            let statement = trimmed.endsWith(';') ? trimmed.slice(0, -1).trim() : trimmed;
            if (!statement || statement === '{' || statement === '}') continue;

            // Catch keyword typos
            const validStartWords = ['spell', 'cast', 'ritual', 'prophecy', 'oracle', 'break', 'next'];
            const firstWord = statement.split(/\s+/)[0];
            
            if (!validStartWords.includes(firstWord) && !statement.includes('=')) {
                let err = new Error(`invalid syntax or unknown keyword '${firstWord}'. Did you misspell a command?`);
                err.name = "SyntaxError";
                err.line = lineNum;
                throw err;
            }
        }
    }

    if (!hasSummon) {
        let err = new Error("Spellbook missing mandatory 'summon' entrypoint.");
        err.name = "SyntaxError";
        err.line = lines.length;
        throw err;
    }
    if (!hasBanish) {
        let err = new Error("Spellbook missing mandatory 'banish' conclusion.");
        err.name = "SyntaxError";
        err.line = lines.length;
        throw err;
    }
    if (braceStack.length > 0) {
        let err = new Error(`Unbalanced opening bracket/brace '${braceStack[braceStack.length - 1].type}'.`);
        err.name = "SyntaxError";
        err.line = braceStack[braceStack.length - 1].line;
        throw err;
    }
}

// Pass 2: Execution Engine (Only runs if syntax is fully valid)
function interpretAuraLang(code, outputEl) {
    const lines = code.split('\n');
    const memory = {};
    let inBody = false;

    for (let i = 0; i < lines.length; i++) {
        let trimmed = lines[i].trim();
        let lineNum = i + 1;

        if (!trimmed || trimmed.startsWith('//')) continue;
        if (trimmed === 'summon') { inBody = true; continue; }
        if (trimmed === 'banish') { inBody = false; continue; }

        if (inBody) {
            let statement = trimmed.endsWith(';') ? trimmed.slice(0, -1).trim() : trimmed;
            if (!statement || statement === '{' || statement === '}') continue;

            // Handle variable declaration: spell name = value
            if (statement.startsWith('spell ')) {
                const declaration = statement.replace('spell ', '').trim();
                const parts = declaration.split('=').map(p => p.trim());
                if (parts.length === 2) {
                    const varName = parts[0];
                    let varVal = parts[1];
                    if ((varVal.startsWith('"') && varVal.endsWith('"')) || (varVal.startsWith("'") && varVal.endsWith("'"))) {
                        memory[varName] = varVal.slice(1, -1);
                    } else {
                        try {
                            memory[varName] = eval(varVal);
                        } catch {
                            let err = new Error(`Invalid syntax or unassigned reference in expression '${varVal}'.`);
                            err.name = "ValueError";
                            err.line = lineNum;
                            throw err;
                        }
                    }
                }
            }
            // Handle variable reassignment: name = expression
            else if (statement.includes('=') && !statement.startsWith('prophecy') && !statement.startsWith('ritual')) {
                const parts = statement.split('=').map(p => p.trim());
                if (parts.length === 2) {
                    const varName = parts[0];
                    const expr = parts[1];
                    if (memory[varName] === undefined) {
                        let err = new Error(`Name '${varName}' is not defined.`);
                        err.name = "NameError";
                        err.line = lineNum;
                        throw err;
                    }
                    try {
                        let evaluatedExpr = expr.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, match => {
                            if (memory[match] === undefined) {
                                throw new Error(`Name '${match}' is not defined.`);
                            }
                            return memory[match];
                        });
                        memory[varName] = eval(evaluatedExpr);
                    } catch (e) {
                        let err = new Error(e.message.includes('is not defined') ? e.message : `Invalid expression '${expr}'.`);
                        err.name = e.message.includes('is not defined') ? "NameError" : "EvaluationError";
                        err.line = lineNum;
                        throw err;
                    }
                }
            }
            // Handle print statement: cast ...
            else if (statement.startsWith('cast ')) {
                const argsStr = statement.replace('cast ', '').trim();
                const rawArgs = argsStr.split(',').map(arg => arg.trim());
                let outputValues = [];

                for (let arg of rawArgs) {
                    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
                        outputValues.push(arg.slice(1, -1));
                    } else if (memory[arg] !== undefined) {
                        outputValues.push(memory[arg]);
                    } else {
                        try {
                            let evaluatedArg = arg.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, match => {
                                if (memory[match] === undefined) {
                                    throw new Error(`Name '${match}' is not defined.`);
                                }
                                return memory[match];
                            });
                            outputValues.push(eval(evaluatedArg));
                        } catch (e) {
                            let err = new Error(e.message.includes('is not defined') ? e.message : `Name '${arg}' is not defined.`);
                            err.name = "NameError";
                            err.line = lineNum;
                            throw err;
                        }
                    }
                }
                outputEl.textContent += `> ${outputValues.join(' ')}\n`;
            }
        }
    }
}
