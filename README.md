# sinos

small programming language that compiles to JS

## todo list

- [ ] variables (with and without type inference)
- [ ] functions
- [ ] conditionals
- [ ] loops (tail call elimination?)
- [ ] more primitive types (float, string)
- [ ] composite types (tuples, records, variants)

## grammar

in PEG form:

```text
Module ← Stmt* End

Stmt ← ExprStmt

ExprStmt ← Expr ";"

Expr ← CmpExpr

CmpExpr ← AddExpr (("==" / "!=" / "<" / "<=" / ">" / ">=") AddExpr)?
AddExpr ← MulExpr (("+" / "-") MulExpr)*
MulExpr ← UnaryExpr (("*" / "/" / "%") UnaryExpr)*
UnaryExpr ← ("-" / "+" / "!")? UnaryExpr
          / Primary

Primary ← "true"
        / "false"
        / Integer
        / ParenOpen Expr ParenClose

Integer ← [0-9]+ [_0-9]*

# Space and Comment are always ignored
Space ← [ \t\r\n]+
Comment ← "--" (!"\n" .)* "\n" 

End ← !.
```

## licence

[mit](LICENSE.txt)
