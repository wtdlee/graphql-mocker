type Listener = (event: any) => void;

// Store for custom GraphQL responses
const customGraphQLResponses = new Map<
  string,
  { response: any; activated: boolean }
>();

const installHook = () => {
  const w = window as any;
  if (w.__GRAPHQL_MOCKER__) {
    return;
  }

  const listeners = new Map<string, Listener[]>();
  const hook = {
    subscribe(eventName: string, listener: Listener) {
      if (!listeners.has(eventName)) listeners.set(eventName, []);
      listeners.get(eventName)?.push(listener);
    },
    sendMessage(data: any) {
      window.postMessage({ source: "graphql-mocker-web-page", data }, "*");
    },
  };

  // Listen for events from content script
  const listenFromContentScript = (event: any) => {
    if (
      event.source === window &&
      event.data?.source === "graphql-mocker-content-script" &&
      event.data?.message !== undefined
    ) {
      listeners
        .get(event.data.type)
        ?.forEach((listener) => listener(event.data));

      // Handle GraphQL custom response updates
      const msg = event.data.message?.msg;
      if (msg?.graphqlCustomResponses) {
        customGraphQLResponses.clear();
        msg.graphqlCustomResponses.forEach((item: any) => {
          if (item.customResponse !== null) {
            customGraphQLResponses.set(item.operationName, {
              response: item.customResponse,
              activated: item.activated,
            });
          }
        });
      }
    }
  };
  window.addEventListener("message", listenFromContentScript);

  // Define a read only, non-overridable property
  Object.defineProperty(window, "__GRAPHQL_MOCKER__", {
    configurable: false,
    enumerable: false,
    get() {
      return hook;
    },
  });
};

installHook();

// Intercept fetch API for GraphQL requests
const originalFetch = window.fetch;

window.fetch = async function (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;

  // Parse request body to detect GraphQL
  let isGraphQL = false;
  let operationName = "unknown";
  let query: string | undefined;
  let variables: any;

  // Check if URL contains graphql endpoint
  if (url.includes("/graphql")) {
    try {
      if (init?.body && typeof init.body === "string") {
        const body = JSON.parse(init.body);
        if (body.query || body.operationName) {
          isGraphQL = true;
          operationName = body.operationName || "unknown";
          query = body.query;
          variables = body.variables;
        }
      }
    } catch (e) {
      // Parsing error - silently continue
    }
  }

  // If not GraphQL, proceed with normal fetch
  if (!isGraphQL) {
    return originalFetch.call(this, input as RequestInfo, init);
  }

  // Check if we have a custom response for this operation
  const customResponse = customGraphQLResponses.get(operationName);
  if (customResponse?.activated) {
    // Return custom response
    const customResponseObj = new Response(
      JSON.stringify(customResponse.response),
      {
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "Content-Type": "application/json",
        }),
      }
    );

    // Still send the captured info to extension
    window.postMessage(
      {
        source: "graphql-mocker-web-page",
        data: {
          from: "content-script",
          to: "datastore",
          msg: {
            type: "graphql-response-captured",
            graphqlResponses: [
              {
                operationName,
                query,
                variables,
                response: customResponse.response,
                timestamp: new Date(),
                url,
              },
            ],
          },
        },
      },
      "*"
    );

    return customResponseObj;
  }

  // Execute original fetch
  const response = await originalFetch.call(this, input as RequestInfo, init);

  // Clone response to read it
  const clonedResponse = response.clone();

  // Read and capture the response
  try {
    const responseData = await clonedResponse.json();

    // Send captured response to extension
    const message = {
      source: "graphql-mocker-web-page",
      data: {
        from: "content-script",
        to: "datastore",
        msg: {
          type: "graphql-response-captured",
          graphqlResponses: [
            {
              operationName,
              query,
              variables,
              response: responseData,
              timestamp: new Date(),
              url,
            },
          ],
        },
      },
    };

    window.postMessage(message, "*");
  } catch (e) {
    // Silently fail if response is not JSON
  }

  return response;
};

// Intercept XMLHttpRequest for GraphQL requests
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  ...rest: any[]
) {
  const urlString = typeof url === "string" ? url : url.toString();
  (this as any)._url = urlString;
  (this as any)._method = method;

  // Add event listeners early for GraphQL requests
  if (urlString.includes("/graphql") && method === "POST") {
    this.addEventListener("load", function () {
      // Skip if this is a mocked request
      if ((this as any)._isMocked) {
        return;
      }

      const graphqlData = (this as any)._graphqlData;

      if (!graphqlData) {
        return;
      }

      if ((this as any)._graphqlSent) {
        return;
      }

      (this as any)._graphqlSent = true;

      try {
        let responseData: any;

        // Handle different responseType
        if (this.responseType === "" || this.responseType === "text") {
          responseData = JSON.parse(this.responseText);
        } else if (this.responseType === "json") {
          responseData = this.response;
        } else if (this.responseType === "arraybuffer") {
          const decoder = new TextDecoder("utf-8");
          const text = decoder.decode(this.response);
          responseData = JSON.parse(text);
        } else {
          responseData = this.response;
          if (typeof responseData === "string") {
            responseData = JSON.parse(responseData);
          }
        }

        window.postMessage(
          {
            source: "graphql-mocker-web-page",
            data: {
              from: "content-script",
              to: "datastore",
              msg: {
                type: "graphql-response-captured",
                graphqlResponses: [
                  {
                    operationName: graphqlData.operationName,
                    query: graphqlData.query,
                    variables: graphqlData.variables,
                    response: responseData,
                    timestamp: new Date(),
                    url: graphqlData.url,
                  },
                ],
              },
            },
          },
          "*"
        );
      } catch (e) {
        // Silent error - response might not be JSON
      }
    });
  }

  return originalXHROpen.apply(this, [method, url, ...rest] as any);
};

XMLHttpRequest.prototype.send = function (
  body?: Document | XMLHttpRequestBodyInit | null
) {
  // Check if this is a mocked request
  if ((this as any)._isMocked) {
    return; // Don't send mocked requests
  }

  const url = (this as any)._url;
  const method = (this as any)._method;

  if (url && url.includes("/graphql") && method === "POST") {
    let operationName = "unknown";
    let query: string | undefined;
    let variables: any;

    try {
      if (body && typeof body === "string") {
        const parsedBody = JSON.parse(body);

        if (parsedBody.query || parsedBody.operationName) {
          operationName = parsedBody.operationName || "unknown";
          query = parsedBody.query;
          variables = parsedBody.variables;

          // Check if we have a custom response for this operation
          const customResponse = customGraphQLResponses.get(operationName);
          if (customResponse?.activated) {
            // Mark as mocked to prevent actual request
            (this as any)._isMocked = true;

            // Mock the XHR response
            const mockResponseText = JSON.stringify(customResponse.response);
            const xhr = this as any;

            // Store original responseType
            const responseType = xhr.responseType || "";

            // Prepare response based on responseType
            let mockResponse: any;
            if (responseType === "json") {
              mockResponse = customResponse.response;
            } else if (responseType === "arraybuffer") {
              const encoder = new TextEncoder();
              mockResponse = encoder.encode(mockResponseText).buffer;
            } else if (responseType === "blob") {
              mockResponse = new Blob([mockResponseText], {
                type: "application/json",
              });
            } else {
              mockResponse = mockResponseText;
            }

            // Override response properties with getters
            Object.defineProperty(xhr, "responseText", {
              configurable: true,
              get: () => mockResponseText,
            });
            Object.defineProperty(xhr, "response", {
              configurable: true,
              get: () => mockResponse,
            });
            Object.defineProperty(xhr, "status", {
              configurable: true,
              get: () => 200,
            });
            Object.defineProperty(xhr, "statusText", {
              configurable: true,
              get: () => "OK",
            });
            Object.defineProperty(xhr, "readyState", {
              configurable: true,
              get: () => 4,
            });

            // Trigger events asynchronously
            setTimeout(() => {
              if (xhr.onreadystatechange) {
                const event = { type: "readystatechange", target: xhr };
                xhr.onreadystatechange.call(xhr, event);
              }

              const loadEvent = new ProgressEvent("load", {
                lengthComputable: true,
                loaded: mockResponseText.length,
                total: mockResponseText.length,
              });
              if (xhr.onload) {
                xhr.onload.call(xhr, loadEvent);
              }
              xhr.dispatchEvent(loadEvent);

              const loadendEvent = new ProgressEvent("loadend", {
                lengthComputable: true,
                loaded: mockResponseText.length,
                total: mockResponseText.length,
              });
              if (xhr.onloadend) {
                xhr.onloadend.call(xhr, loadendEvent);
              }
              xhr.dispatchEvent(loadendEvent);
            }, 10);

            return; // Don't send the actual request
          }

          // Store data for later use
          (this as any)._graphqlData = {
            operationName,
            query,
            variables,
            url,
          };
        }
      }
    } catch (e) {
      // Parsing error - silently continue
    }
  }

  return originalXHRSend.apply(this, [body] as any);
};

// Make this script a module
export {};
