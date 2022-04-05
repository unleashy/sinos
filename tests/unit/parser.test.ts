import { test } from "uvu";
import * as assert from "uvu/assert";
import dedent from "ts-dedent";
import { File } from "../../src/file";
import { Span } from "../../src/span";
import { SinosError, errorKinds } from "../../src/error";
import { Lexer } from "../../src/lexer";
import { Ast } from "../../src/ast";
import { Parser } from "../../src/parser";

type TestCase =
  | { desc: string; input: string; output?: string; only?: boolean }
  | {
      desc: string;
      input: string;
      error: (makeSpan: (index: number, length: number) => Span) => SinosError;
      only?: boolean;
    };

const testCases: TestCase[] = [
  {
    desc: "accepts no input",
    input: "",
    output: `
      module<0,0>
    `
  },
  {
    desc: "accepts a name",
    input: "foobar;",
    output: `
      module<0,7>
        exprStmt<0,7>
          name<0,6> foobar
    `
  },
  {
    desc: "accepts a single integer",
    input: "1234;",
    output: `
      module<0,5>
        exprStmt<0,5>
          integer<0,4> 1234
    `
  },
  {
    desc: "accepts a single float",
    input: "3.14159;",
    output: `
      module<0,8>
        exprStmt<0,8>
          float<0,7> 3.14159
    `
  },
  {
    desc: "accepts a true boolean",
    input: "true;",
    output: `
      module<0,5>
        exprStmt<0,5>
          boolean<0,4> true
    `
  },
  {
    desc: "accepts a false boolean",
    input: "false;",
    output: `
      module<0,6>
        exprStmt<0,6>
          boolean<0,5> false
    `
  },
  {
    desc: "accepts a single string",
    input: `"hello world";`,
    output: `
      module<0,14>
        exprStmt<0,14>
          string<0,13> "hello world"
    `
  },
  {
    desc: "accepts unary expressions",
    input: "!-+1;",
    output: `
      module<0,5>
        exprStmt<0,5>
          unary<0,4> !
            unary<1,3> -
              unary<2,2> +
                integer<3,1> 1
    `
  },
  {
    desc: "accepts mul expressions",
    input: "1 * 2 / 3 % 4;",
    output: `
      module<0,14>
        exprStmt<0,14>
          binary<0,13> %
            binary<0,9> /
              binary<0,5> *
                integer<0,1> 1
                integer<4,1> 2
              integer<8,1> 3
            integer<12,1> 4
    `
  },
  {
    desc: "accepts add expressions",
    input: "1 + 2 - 3;",
    output: `
      module<0,10>
        exprStmt<0,10>
          binary<0,9> -
            binary<0,5> +
              integer<0,1> 1
              integer<4,1> 2
            integer<8,1> 3
    `
  },
  {
    desc: "accepts cat expressions",
    input: `"a" ~ "b" ~ "c";`,
    output: `
      module<0,16>
        exprStmt<0,16>
          binary<0,15> ~
            binary<0,9> ~
              string<0,3> "a"
              string<6,3> "b"
            string<12,3> "c"
    `
  },
  {
    desc: "accepts eq expressions (equals)",
    input: "1 == 2;",
    output: `
      module<0,7>
        exprStmt<0,7>
          binary<0,6> ==
            integer<0,1> 1
            integer<5,1> 2
    `
  },
  {
    desc: "accepts eq expressions (not equals)",
    input: "1 != 2;",
    output: `
      module<0,7>
        exprStmt<0,7>
          binary<0,6> !=
            integer<0,1> 1
            integer<5,1> 2
    `
  },
  {
    desc: "accepts cmp expressions (less than)",
    input: "1 < 2;",
    output: `
      module<0,6>
        exprStmt<0,6>
          binary<0,5> <
            integer<0,1> 1
            integer<4,1> 2
    `
  },
  {
    desc: "accepts cmp expressions (less than or equal to)",
    input: "1 <= 2;",
    output: `
      module<0,7>
        exprStmt<0,7>
          binary<0,6> <=
            integer<0,1> 1
            integer<5,1> 2
    `
  },
  {
    desc: "accepts cmp expressions (greater than)",
    input: "1 > 2;",
    output: `
      module<0,6>
        exprStmt<0,6>
          binary<0,5> >
            integer<0,1> 1
            integer<4,1> 2
    `
  },
  {
    desc: "accepts cmp expressions (greater than or equal to)",
    input: "1 >= 2;",
    output: `
      module<0,7>
        exprStmt<0,7>
          binary<0,6> >=
            integer<0,1> 1
            integer<5,1> 2
    `
  },
  {
    desc: "accepts parenthesised expressions",
    input: "(1 + 2);",
    output: `
      module<0,8>
        exprStmt<0,8>
          group<0,7>
            binary<1,5> +
              integer<1,1> 1
              integer<5,1> 2
    `
  },
  {
    desc: "accepts a sequence of statements",
    input: "1; 2; 3;",
    output: `
      module<0,8>
        exprStmt<0,2>
          integer<0,1> 1
        exprStmt<3,2>
          integer<3,1> 2
        exprStmt<6,2>
          integer<6,1> 3
    `
  },
  {
    desc: "follows precedence and associativity correctly",
    input: "1 + 2 - 3 * 4 / 5 ~ 6 > 7 == 8 < 9;",
    output: `
      module<0,35>
        exprStmt<0,35>
          binary<0,34> ==
            binary<0,25> >
              binary<0,21> ~
                binary<0,17> -
                  binary<0,5> +
                    integer<0,1> 1
                    integer<4,1> 2
                  binary<8,9> /
                    binary<8,5> *
                      integer<8,1> 3
                      integer<12,1> 4
                    integer<16,1> 5
                integer<20,1> 6
              integer<24,1> 7
            binary<29,5> <
              integer<29,1> 8
              integer<33,1> 9
    `
  },
  {
    desc: "errors on chained equality operators (equals)",
    input: "1 == 2 == 3;",
    error: s => new SinosError(errorKinds.eqChain, s(5, 6))
  },
  {
    desc: "errors on chained equality operators (not equals)",
    input: "1 == 2 != 3;",
    error: s => new SinosError(errorKinds.eqChain, s(5, 6))
  },
  {
    desc: "errors on chained comparison operators",
    input: "1 < 2 <= 3;",
    error: s => new SinosError(errorKinds.cmpChain, s(4, 6))
  },
  {
    desc: "accepts let statements",
    input: "let name = 1 + 2;",
    output: `
      module<0,17>
        letStmt<0,17> "name"
          binary<11,5> +
            integer<11,1> 1
            integer<15,1> 2
    `
  },
  {
    desc: "accepts let statements with type",
    input: "let name: Bool = true;",
    output: `
      module<0,22>
        letStmt<0,22> "name" : Bool
          boolean<17,4> true
    `
  },
  {
    desc: "errors on missing semicolon",
    input: "1",
    error: s => new SinosError(errorKinds.expectSemi, s(1, 0))
  },
  {
    desc: "errors on missing input",
    input: "1 + ",
    error: s => new SinosError(errorKinds.expectExpr, s(4, 0))
  },
  {
    desc: "errors on missing close parenthesis",
    input: "(1",
    error: s => new SinosError(errorKinds.expectParenClose, s(2, 0))
  },
  {
    desc: "errors on missing name for let statement",
    input: "let = 1;",
    error: s => new SinosError(errorKinds.expectName, s(4, 1))
  },
  {
    desc: "errors on missing equals for let statement",
    input: "let a == 1;",
    error: s => new SinosError(errorKinds.expectEqual, s(6, 2))
  },
  {
    desc: "errors on missing type after colon for let statement",
    input: "let a: = 1;",
    error: s => new SinosError(errorKinds.expectName, s(7, 1))
  },
  {
    desc: "errors on missing expression for let statement",
    input: "let a = ;",
    error: s => new SinosError(errorKinds.expectExpr, s(8, 1))
  },
  {
    desc: "errors on missing semicolon for let statement",
    input: "let a = 1",
    error: s => new SinosError(errorKinds.expectSemi, s(9, 0))
  },
  {
    desc: "accepts empty blocks",
    input: "{}",
    output: `
      module<0,2>
        exprStmt<0,2>
          block<0,2>
    `
  },
  {
    desc: "accepts a block with a semicolon",
    input: "{};",
    output: `
      module<0,3>
        exprStmt<0,3>
          block<0,2>
    `
  },
  {
    desc: "accepts a block with a single statement",
    input: "{ 1; }",
    output: `
      module<0,6>
        exprStmt<0,6>
          block<0,6>
            exprStmt<2,2>
              integer<2,1> 1
    `
  },
  {
    desc: "accepts a block with multiple statements",
    input: "{ let a = 1; a; 4 * 4; }",
    output: `
      module<0,24>
        exprStmt<0,24>
          block<0,24>
            letStmt<2,10> "a"
              integer<10,1> 1
            exprStmt<13,2>
              name<13,1> a
            exprStmt<16,6>
              binary<16,5> *
                integer<16,1> 4
                integer<20,1> 4
    `
  },
  {
    desc: "accepts a block with a single last expression",
    input: "{ 1 }",
    output: `
      module<0,5>
        exprStmt<0,5>
          block<0,5>
            integer<2,1> 1
    `
  },
  {
    desc: "accepts a block with a statement and a last expression",
    input: "{ true; false }",
    output: `
      module<0,15>
        exprStmt<0,15>
          block<0,15>
            exprStmt<2,5>
              boolean<2,4> true
            boolean<8,5> false
    `
  },
  {
    desc: "accepts a block with a last expression that is a block",
    input: "{ { 1 } }",
    output: `
      module<0,9>
        exprStmt<0,9>
          block<0,9>
            block<2,5>
              integer<4,1> 1
    `
  },
  {
    desc: "accepts a block with multiple blocks inside it",
    input: "{ { 1 } { 2 } }",
    output: `
      module<0,15>
        exprStmt<0,15>
          block<0,15>
            exprStmt<2,5>
              block<2,5>
                integer<4,1> 1
            block<8,5>
              integer<10,1> 2
    `
  },
  {
    desc: "accepts a block with multiple blocks and statements inside it",
    input: "{ { a; } 1 + 2; { b }; }",
    output: `
      module<0,24>
        exprStmt<0,24>
          block<0,24>
            exprStmt<2,6>
              block<2,6>
                exprStmt<4,2>
                  name<4,1> a
            exprStmt<9,6>
              binary<9,5> +
                integer<9,1> 1
                integer<13,1> 2
            exprStmt<16,6>
              block<16,5>
                name<18,1> b
    `
  },
  {
    desc: "errors on unclosed blocks",
    input: "{ 1; ",
    error: s => new SinosError(errorKinds.expectBraceClose, s(5, 0))
  },
  {
    desc: "errors on statements missing a semicolon",
    input: "{ 1 2 }",
    error: s => new SinosError(errorKinds.expectSemi, s(4, 1))
  }
];

for (const testCase of testCases) {
  const testFn = () => {
    const file = new File("<test>", testCase.input);
    const sut = new Parser(new Lexer(file));

    try {
      const actual = sut.parse();
      const snap = printAst(actual);

      if ("output" in testCase && testCase.output !== undefined) {
        const prevSnap = dedent(testCase.output);
        assert.snapshot(snap, prevSnap);
      } else {
        assert.unreachable(
          `Generated a snapshot since one was not supplied:\n\n${snap}\n\n` +
            `Copy and paste into the test case’s output.`
        );
      }
    } catch (e) {
      if (e instanceof SinosError && "error" in testCase) {
        const expected = testCase.error(
          (index, length) => new Span(file, index, length)
        );
        assert.equal(e, expected);
      } else {
        throw e;
      }
    }
  };

  if (testCase.only) {
    test.only(`parser ${testCase.desc}`, testFn);
  } else {
    test(`parser ${testCase.desc}`, testFn);
  }
}

function printAst(ast: Ast): string {
  function indented(s: string): string {
    return s
      .split("\n")
      .map(s => "  " + s)
      .join("\n");
  }

  let result = `${ast.kind}<${ast.span.index},${ast.span.length}>`;

  switch (ast.kind) {
    case "module":
      if (ast.stmts.length > 0) {
        const stmts = ast.stmts
          .map(stmt => indented(printAst(stmt)))
          .join("\n");

        result += `\n${stmts}`;
      }
      break;

    case "letStmt": {
      result += ` "${ast.name}"`;
      if (ast.type) result += ` : ${ast.type}`;
      const value = indented(printAst(ast.value));

      result += `\n${value}`;
      break;
    }

    case "exprStmt": {
      const expr = indented(printAst(ast.expr));

      result += `\n${expr}`;
      break;
    }

    case "block": {
      if (ast.stmts.length > 0) {
        const stmts = ast.stmts
          .map(stmt => indented(printAst(stmt)))
          .join("\n");

        result += `\n${stmts}`;
      }

      if (ast.lastExpr) {
        const lastExpr = indented(printAst(ast.lastExpr));

        result += `\n${lastExpr}`;
      }

      break;
    }

    case "binary": {
      const left = indented(printAst(ast.left));
      const right = indented(printAst(ast.right));

      result += ` ${ast.op}\n${left}\n${right}`;
      break;
    }

    case "unary": {
      const expr = indented(printAst(ast.expr));

      result += ` ${ast.op}\n${expr}`;
      break;
    }

    case "group":
      const expr = indented(printAst(ast.expr));

      result += `\n${expr}`;
      break;

    case "name":
    case "integer":
    case "float":
    case "boolean":
      result += ` ${ast.value}`;
      break;

    case "string":
      result += ` ${JSON.stringify(ast.value)}`;
      break;

    default:
      // @ts-ignore
      assert.unreachable(`Unhandled AST node of kind ${ast.kind}`);
  }

  return result;
}

test.run();
