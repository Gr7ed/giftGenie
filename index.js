import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  autoResizeTextarea,
  setLoading,
  showStream,
} from "./utils.js";



// Get UI elements
const giftForm = document.getElementById("gift-form");
const userInput = document.getElementById("user-input");
const outputContent = document.getElementById("output-content");

function start() {
  // Setup UI event listeners
  userInput.addEventListener("input", () => autoResizeTextarea(userInput));
  giftForm.addEventListener("submit", handleGiftRequest);
}

async function handleGiftRequest(e) {
  // Prevent default form submission
  e.preventDefault();

  // Get user input, trim whitespace, exit if empty
  const userPrompt = userInput.value.trim();
  if (!userPrompt) return;

  // Set loading state (hides output, animates lamp)
  setLoading(true);


  try {
    // Send POST request to server with user prompt
    const response = await fetch("/api/gifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrompt }),
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    // Show output container immediately for streaming feedback
    showStream();

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let text = "";
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      // Keep the last partial line in the buffer
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.trim() === "") continue;
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") return;
          
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.content) {
              text += parsed.content;
              outputContent.innerHTML = DOMPurify.sanitize(marked.parse(text));
            }
          } catch (e) {
            console.error("Error parsing chunk:", e);
          }
        }
      }
    }
  } catch (err) {
    // Log the error for debugging
    console.error(err);

    // Display friendly error message
    outputContent.textContent =
      "Sorry, I can't access what I need right now. Please try again in a bit.";
  } finally {
    // Always clear loading state (shows output, resets lamp)
    setLoading(false);
  }
}

start();
