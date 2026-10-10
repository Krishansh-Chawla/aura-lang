function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    
    document.getElementById(viewName + '-view').classList.add('active');
    document.getElementById('nav-' + viewName).classList.add('active');
}

function clearConsole() {
    document.getElementById('output').innerText = "Ready to cast spells...";
}

class AuraLangInterpreter {
    constructor(outputCallback) {
        this.outputFn = outputCallback;
        this.vars = {};
    }

    run(code) {
        this.vars = {};
        const match = code.match(/summon([\s\S]*?)banish/);
        if (!match) {
            throw new Error("Spellbook error: Must start with 'summon' and end with 'banish'");
        }
        this.execute(match[1]);
    }

    execute(codeStr) {
        let i = 0;
        while (i < codeStr.length) {
            while (i < codeStr.length && /\s/.test(codeStr[i])) i++;
            if (i >= codeStr.length) break;

            if (codeStr.startsWith('//', i)) {
                while (i < codeStr.length && codeStr[i] !== '\n') i++;
                continue;
            }

            if (codeStr.startsWith('break rune', i)) {
                i += 10;
                while (i < codeStr.length && codeStr[i] !== ';') i++;
                if (codeStr[i] === ';') i++;
                throw { type: 'BREAK' };
            }

            if (codeStr.startsWith('next rune', i)) {
                i += 9;
                while (i < codeStr.length && codeStr[i] !== ';') i++;
                if (codeStr[i] === ';') i++;
                throw { type: 'CONTINUE' };
            }

            if (codeStr.startsWith('ritual', i)) {
                i += 6;
                while (i < codeStr.length && /\s/.test(codeStr[i])) i++;
                if (codeStr[i] !== '(') throw new Error("Expected '(' after ritual");
                
                let condStart = ++i;
                let parenCount = 1;
                while (i < codeStr.length && parenCount > 0) {
                    if (codeStr[i] === '(') parenCount++;
                    if (codeStr[i] === ')') parenCount--;
                    if (parenCount > 0) i++;
                }
                let condStr = codeStr.substring(condStart, i);
                i++;

                while (i < codeStr.length && /\s/.test(codeStr[i])) i++;
                if (codeStr[i] !== '{') throw new Error("Expected '{' for ritual block");
                
                let ritualBodyResult = this.extractBraceBlock(codeStr, i);
                i = ritualBodyResult.endIdx;

                while (this.evaluate(condStr)) {
                    try {
                        this.execute(ritualBodyResult.blockContent);
                    } catch (signal) {
                        if (signal.type === 'BREAK') break;
                        if (signal.type === 'CONTINUE') continue;
                        throw signal;
                    }
                }
                continue;
            }

            if (codeStr.startsWith('prophecy', i)) {
                i += 8;
                while (i < codeStr.length && /\s/.test(codeStr[i])) i++;
                if (codeStr[i] !== '(') throw new Error("Expected '(' after prophecy");
                
                let condStart = ++i;
                let parenCount = 1;
                while (i < codeStr.length && parenCount > 0) {
                    if (codeStr[i] === '(') parenCount++;
                    if (codeStr[i] === ')') parenCount--;
                    if (parenCount > 0) i++;
                }
                let condStr = codeStr.substring(condStart, i);
                i++;

                while (i < codeStr.length && /\s/.test(codeStr[i])) i++;
                if (codeStr[i] !== '{') throw new Error("Expected '{' for prophecy block");
                
                let propBodyResult = this.extractBraceBlock(codeStr, i);
                i = propBodyResult.endIdx;

                while (i < codeStr.length && /\s/.test(codeStr[i])) i++;
                let oracleBodyStr = null;
                if (codeStr.startsWith('oracle', i)) {
                    i += 6;
                    while (i < codeStr.length && /\s/.test(codeStr[i])) i++;
                    if (codeStr[i] !== '{') throw new Error("Expected '{' for oracle block");
                    let oracleResult = this.extractBraceBlock(codeStr, i);
                    oracleBodyStr = oracleResult.blockContent;
                    i = oracleResult.endIdx;
                }

                let condVal = this.evaluate(condStr);
                if (condVal) {
                    this.execute(propBodyResult.blockContent);
                } else if (oracleBodyStr !== null) {
                    this.execute(oracleBodyStr);
                }
                continue;
            }

            if (codeStr.startsWith('cast', i)) {
                i += 4;
                let semiIdx = codeStr.indexOf(';', i);
                if (semiIdx === -1) throw new Error("Missing ';' after cast");
                let expr = codeStr.substring(i, semiIdx).trim();
                let parts = expr.split(',').map(p => this.evaluate(p.trim()));
                this.outputFn(parts.join(' '));
                i = semiIdx + 1;
                continue;
            }

            let sub = codeStr.slice(i);
            let assignMatch = sub.match(/^(?:spell\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;]+);/);
            if (assignMatch) {
                let varName = assignMatch[1];
                let valExpr = assignMatch[2];
                this.vars[varName] = this.evaluate(valExpr);
                i += assignMatch[0].length;
                continue;
            }

            i++;
        }
    }

    extractBraceBlock(str, openIdx) {
        let i = openIdx + 1;
        let braceCount = 1;
        let start = i;

        while (i < str.length && braceCount > 0) {
            if (str[i] === '{') braceCount++;
            if (str[i] === '}') braceCount--;
            if (braceCount > 0) i++;
        }

        let content = str.substring(start, i);
        return {
            blockContent: content,
            endIdx: i + 1
        };
    }

    evaluate(expr) {
        if (!expr) return null;
        expr = expr.trim();
        if (expr === 'pure') return true;
        if (expr === 'dark') return false;
        if (expr === 'void') return null;
        if (!isNaN(expr)) return Number(expr);
        if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
            return expr.slice(1, -1);
        }
        if (expr in this.vars) return this.vars[expr];
        
        try {
            let evalStr = expr;
            for (let [k, v] of Object.entries(this.vars)) {
                evalStr = evalStr.replace(new RegExp('\\b' + k + '\\b', 'g'), typeof v === 'string' ? `"${v}"` : v);
            }
            return eval(evalStr);
        } catch {
            return expr;
        }
    }
}

function runCode() {
    const code = document.getElementById('codeEditor').value;
    const outputDiv = document.getElementById('output');
    outputDiv.innerText = " ✨ Casting spell...\n";

    try {
        const interpreter = new AuraLangInterpreter((msg) => {
            outputDiv.innerText += `> ${msg}\n`;
        });
        interpreter.run(code);
        outputDiv.innerText += "✨ Spell executed successfully!";
    } catch (err) {
        outputDiv.innerText += `❌ Arcane Backlash: ${err.message}`;
    }
}