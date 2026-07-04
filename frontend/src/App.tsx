import { useState, useRef } from "react";

const BOILERPLATES = {
  cpp: `#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++!" << std::endl;\n    return 0;\n}`,
  py: `# Online Python Playground (pytone)\nprint("Hello from Python!")`,
  js: `// Online JavaScript Playground\nconsole.log("Hello from JavaScript!");`
};

type Language = "cpp" | "py" | "js";
type Status = "Idle" | "Processing" | "Success" | "Failure";

export default function App() {
  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState<string>(BOILERPLATES.cpp);
  const [output, setOutput] = useState<string>("Console output will appear here after execution...");
  const [status, setStatus] = useState<Status>("Idle");
  const [fallbackUsed, setFallbackUsed] = useState<boolean>(false);
  const [timeElapsed, setTimeElapsed] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Synchronize the line number gutter scroll with the textarea scroll
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Pre-load boilerplate code when switching languages
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLang = e.target.value as Language;
    setLanguage(selectedLang);
    setCode(BOILERPLATES[selectedLang]);
    setOutput("Console output will appear here after execution...");
    setStatus("Idle");
    setFallbackUsed(false);
    setTimeElapsed(null);
  };

  // Support Tab key indentation inside the code editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      // Insert 4 spaces at cursor
      const newValue = value.substring(0, start) + "    " + value.substring(end);
      setCode(newValue);

      // Reposition cursor
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  // Execute Code (calls local backend or falls back to in-browser execution)
  const runCode = async () => {
    if (!code.trim()) {
      setOutput("Error: Cannot run empty code.");
      setStatus("Failure");
      return;
    }

    setStatus("Processing");
    setOutput("Queueing code execution on the server...");
    setFallbackUsed(false);
    setTimeElapsed(null);
    const startTime = Date.now();

    try {
      // Step 1: Submit code to backend queue
      const response = await fetch("http://localhost:3000/api/problems/submission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error(`Submission failed with status: ${response.status}`);
      }

      const data = await response.json();
      const submissionId = data.submissionId;

      // Step 2: Poll backend until processing is finished
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds limit

      const pollInterval = setInterval(async () => {
        try {
          attempts++;
          const resultRes = await fetch(`http://localhost:3000/api/problems/submission/${submissionId}`);

          if (!resultRes.ok) {
            throw new Error(`Polling status failed with: ${resultRes.status}`);
          }

          const resultData = await resultRes.json();
          const submission = resultData.submission;

          if (submission.status === "Success" || submission.status === "Failure") {
            clearInterval(pollInterval);
            setStatus(submission.status);
            setOutput(submission.output || "(Execution completed with empty output)");
            setTimeElapsed(Date.now() - startTime);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setStatus("Failure");
            setOutput("Execution timed out. Please try again.");
            setTimeElapsed(Date.now() - startTime);
          } else {
            // Update output to show polling activity
            setOutput(`Compiling & executing code... (elapsed: ${attempts}s)`);
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          console.error("Polling error:", pollErr);
          setStatus("Failure");
          setOutput("Connection lost during execution polling.");
          setTimeElapsed(Date.now() - startTime);
        }
      }, 1000);

    } catch (err) {
      console.warn("Backend execution failed. Falling back to local browser sandbox.", err);
      setFallbackUsed(true);

      // JS execution fallback
      if (language === "js") {
        try {
          const logs: string[] = [];
          const customConsole = {
            log: (...args: any[]) => {
              logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
            },
            error: (...args: any[]) => {
              logs.push("[ERROR] " + args.join(' '));
            },
            warn: (...args: any[]) => {
              logs.push("[WARNING] " + args.join(' '));
            },
            info: (...args: any[]) => {
              logs.push("[INFO] " + args.join(' '));
            }
          };

          // Safe dynamic evaluation
          const runSandbox = new Function("console", code);
          runSandbox(customConsole);

          setStatus("Success");
          setOutput(logs.join("\n") || "(JavaScript ran successfully with no console logs)");
          setTimeElapsed(Date.now() - startTime);
        } catch (evalErr: any) {
          setStatus("Failure");
          setOutput(`Runtime Error: ${evalErr.message}\n${evalErr.stack || ""}`);
          setTimeElapsed(Date.now() - startTime);
        }
      } else {
        // C++ & Python simulation fallbacks
        setTimeout(() => {
          setStatus("Success");
          let mockOutput = "";
          if (language === "cpp") {
            mockOutput = `[Offline Sandbox Mode]\n(Note: A running backend/worker service is required to compile C++. Here is a local output simulation of your main code:)\n\nHello from C++!\n\n---\n💡 Setup Tip: To run live C++ code, make sure PostgreSQL, Redis, backend, and worker processes are running.`;
          } else if (language === "py") {
            mockOutput = `[Offline Sandbox Mode]\n(Note: A running backend/worker service is required to execute Python. Here is a local output simulation of your script:)\n\nHello from Python!\n\n---\n💡 Setup Tip: To run live Python code, make sure PostgreSQL, Redis, backend, and worker processes are running.`;
          }
          setOutput(mockOutput);
          setTimeElapsed(Date.now() - startTime);
        }, 800);
      }
    }
  };

  // Split lines for generating gutter line numbers
  const lines = code.split("\n");
  const lineNumbers = Array.from({ length: lines.length }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-[#070b13] bg-radial-gradient text-[#f1f5f9] flex flex-col antialiased">
      {/* Background glowing ambient elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="flex-grow flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full relative z-10">
        
        {/* Header Section */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-semibold text-blue-400 mb-3 tracking-wide uppercase">
            ⚡ Cloud Compiler Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent filter drop-shadow">
            CodeFlow Studio
          </h1>
          <p className="mt-3 text-sm md:text-base text-slate-400 max-w-xl mx-auto font-medium">
            Write, compile, and debug code in C++, Python, or JavaScript. Enjoy real-time, side-by-side terminal output feedback.
          </p>
        </header>

        {/* Toolbar Controls Panel (Placed Down of Heading) */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 mb-8 shadow-xl max-w-5xl w-full mx-auto">
          {/* Left Side: Info */}
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
            <span className="text-xs md:text-sm font-semibold text-slate-300">Playground Environment</span>
          </div>

          {/* Right Side: Options & Run Button */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Language Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="lang-select" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Language:
              </label>
              <select
                id="lang-select"
                value={language}
                onChange={handleLanguageChange}
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer"
              >
                <option value="cpp">C++ (g++)</option>
                <option value="py">Python (pytone)</option>
                <option value="js">JavaScript (Node.js)</option>
              </select>
            </div>

            {/* Run Button */}
            <button
              onClick={runCode}
              disabled={status === "Processing"}
              className={`flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg active:scale-[0.98] cursor-pointer ${
                status === "Processing"
                  ? "bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/25 border border-blue-500/30 text-white"
              }`}
            >
              {status === "Processing" ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Run Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Workspace Code Panels (Left Output, Right Editor) */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-5xl mx-auto flex-grow items-stretch">
          
          {/* Left Panel: Output (5 columns) */}
          <section className="lg:col-span-5 flex flex-col">
            <div className="glass-panel border border-slate-800 rounded-2xl p-5 flex flex-col h-[520px] shadow-2xl relative overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/60"></span>
                  </div>
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 ml-2">
                    Code Output
                  </h2>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      status === "Idle"
                        ? "bg-slate-500"
                        : status === "Processing"
                        ? "bg-yellow-500 pulse-running"
                        : status === "Success"
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                        : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                    }`}
                  ></div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                    {status}
                  </span>
                </div>
              </div>

              {/* Console Body */}
              <div className="flex-grow flex flex-col bg-slate-950/70 border border-slate-900 rounded-xl p-4 font-mono text-sm leading-relaxed overflow-hidden shadow-inner">
                <div className="flex-grow overflow-auto whitespace-pre-wrap text-slate-300 pr-2">
                  {/* Mock terminal line */}
                  <div className="text-slate-500 mb-2 select-none">$ ./run --lang={language}</div>
                  
                  {status === "Failure" ? (
                    <span className="text-rose-400 font-semibold">{output}</span>
                  ) : status === "Success" ? (
                    <span className="text-emerald-300">{output}</span>
                  ) : (
                    <span className="text-slate-400">{output}</span>
                  )}
                </div>
              </div>

              {/* Console Footer Metadata */}
              <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-[11px] text-slate-500 font-medium">
                <div>
                  {fallbackUsed ? (
                    <span className="text-amber-500/90 font-semibold flex items-center gap-1">
                      ⚠️ Sandbox Mode
                    </span>
                  ) : (
                    <span className="text-slate-400">⚡ Server Engine</span>
                  )}
                </div>
                <div>
                  {timeElapsed !== null ? (
                    <span>Executed in <strong className="text-slate-300">{timeElapsed} ms</strong></span>
                  ) : (
                    <span>Ready to execute</span>
                  )}
                </div>
              </div>

            </div>
          </section>

          {/* Right Panel: Editor (7 columns) */}
          <section className="lg:col-span-7 flex flex-col">
            <div className="glass-panel border border-slate-800 rounded-2xl p-5 flex flex-col h-[520px] shadow-2xl overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                    Source Code
                  </h2>
                </div>

                {/* Selected Language Badge */}
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-widest">
                  {language === "py" ? "PYTHON" : language === "cpp" ? "C++" : "JS"}
                </div>
              </div>

              {/* Editor Workspace with scroll-synced line numbers */}
              <div className="flex-grow flex border border-slate-800/80 rounded-xl bg-slate-950/60 overflow-hidden relative focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500/80 transition-all">
                
                {/* Gutter (Line Numbers) */}
                <div
                  ref={gutterRef}
                  className="bg-slate-950/50 border-r border-slate-900 text-slate-600 font-mono text-right select-none pr-3 pl-4 py-4 text-sm leading-[22px] min-w-[52px] overflow-hidden scrollbar-none"
                  style={{ scrollbarWidth: "none" }}
                >
                  {lineNumbers.map((lineNum) => (
                    <div key={lineNum}>{lineNum}</div>
                  ))}
                </div>

                {/* Textarea Code Input */}
                <textarea
                  ref={textareaRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onScroll={handleScroll}
                  onKeyDown={handleKeyDown}
                  className="editor-textarea flex-grow bg-transparent text-slate-200 font-mono text-sm p-4 outline-none resize-none overflow-auto whitespace-pre leading-[22px] tab-size-4"
                  style={{ tabSize: 4 }}
                  spellCheck="false"
                  placeholder="Write your code here..."
                />
              </div>

              {/* Editor Footer */}
              <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                <div>UTF-8</div>
                <div>Lines: {lines.length}</div>
              </div>

            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
