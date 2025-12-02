// JSON-compatible types
type JsonPrimitive = string | number | boolean | null;
type JsonArray = JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonArray | JsonObject;

type Listener = (event: ContentScriptMessage) => void;

interface CustomResponseData {
  response: JsonValue;
  activated: boolean;
  delay?: number;
}

interface MockerSettings {
  globalMockEnabled: boolean;
  darkMode: boolean;
}

interface ContentScriptMessage {
  source: string;
  type?: string;
  message?: {
    msg?: {
      graphqlCustomResponses?: Array<{
        operationName: string;
        customResponse: JsonValue;
        activated: boolean;
        delay?: number;
      }>;
      settings?: MockerSettings;
    };
  };
}

// Store for custom GraphQL responses
const customGraphQLResponses = new Map<string, CustomResponseData>();
let mockerSettings: MockerSettings = { globalMockEnabled: true, darkMode: true };

// Helper function to delay
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

interface GraphQLMockerHook {
  subscribe(eventName: string, listener: Listener): void;
  sendMessage(data: JsonValue): void;
}

const installHook = () => {
  const w = window as Window & { __GRAPHQL_MOCKER__?: GraphQLMockerHook };
  if (w.__GRAPHQL_MOCKER__) {
    return;
  }

  const listeners = new Map<string, Listener[]>();
  const hook: GraphQLMockerHook = {
    subscribe(eventName: string, listener: Listener) {
      if (!listeners.has(eventName)) listeners.set(eventName, []);
      listeners.get(eventName)?.push(listener);
    },
    sendMessage(data: JsonValue) {
      window.postMessage({ source: 'graphql-mocker-web-page', data }, '*');
    },
  };

  // Listen for events from content script
  const listenFromContentScript = (event: MessageEvent) => {
    const eventData = event.data as ContentScriptMessage | undefined;
    if (
      event.source === window &&
      eventData?.source === 'graphql-mocker-content-script' &&
      eventData?.message !== undefined
    ) {
      if (eventData.type) {
        listeners.get(eventData.type)?.forEach(listener => listener(eventData));
      }

      // Handle GraphQL custom response updates
      const msg = eventData.message?.msg;
      if (msg?.graphqlCustomResponses) {
        customGraphQLResponses.clear();
        msg.graphqlCustomResponses.forEach(item => {
          if (item.customResponse !== null) {
            customGraphQLResponses.set(item.operationName, {
              response: item.customResponse,
              activated: item.activated,
              delay: item.delay,
            });
          }
        });
      }

      // Handle settings updates
      if (msg?.settings) {
        mockerSettings = msg.settings;
      }
    }
  };
  window.addEventListener('message', listenFromContentScript);

  // Define a read only, non-overridable property
  Object.defineProperty(window, '__GRAPHQL_MOCKER__', {
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

window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Parse request body to detect GraphQL
  let isGraphQL = false;
  let operationName = 'unknown';
  let query: string | undefined;
  let variables: Record<string, unknown> | undefined;
  const startTime = performance.now();

  // Check if URL contains graphql endpoint
  if (url.includes('/graphql')) {
    try {
      if (init?.body && typeof init.body === 'string') {
        const body = JSON.parse(init.body) as {
          query?: string;
          operationName?: string;
          variables?: Record<string, unknown>;
        };
        if (body.query || body.operationName) {
          isGraphQL = true;
          operationName = body.operationName || 'unknown';
          query = body.query;
          variables = body.variables;
        }
      }
    } catch {
      // Parsing error - silently continue
    }
  }

  // If not GraphQL, proceed with normal fetch
  if (!isGraphQL) {
    return originalFetch.call(this, input as RequestInfo, init);
  }

  // Check if we have a custom response for this operation
  const customResponse = customGraphQLResponses.get(operationName);
  if (customResponse?.activated && mockerSettings.globalMockEnabled) {
    // Apply delay if configured
    if (customResponse.delay && customResponse.delay > 0) {
      await delay(customResponse.delay);
    }

    // Return custom response
    const customResponseObj = new Response(JSON.stringify(customResponse.response), {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });

    const duration = Math.round(performance.now() - startTime);

    // Still send the captured info to extension
    window.postMessage(
      {
        source: 'graphql-mocker-web-page',
        data: {
          from: 'content-script',
          to: 'datastore',
          msg: {
            type: 'graphql-response-captured',
            graphqlResponses: [
              {
                operationName,
                query,
                variables,
                response: customResponse.response,
                timestamp: Date.now(),
                url,
                duration,
              },
            ],
          },
        },
      },
      '*'
    );

    return customResponseObj;
  }

  // Execute original fetch
  const response = await originalFetch.call(this, input as RequestInfo, init);
  const duration = Math.round(performance.now() - startTime);

  // Clone response to read it
  const clonedResponse = response.clone();

  // Read and capture the response
  try {
    const responseData = (await clonedResponse.json()) as JsonValue;

    // Send captured response to extension
    const message = {
      source: 'graphql-mocker-web-page',
      data: {
        from: 'content-script',
        to: 'datastore',
        msg: {
          type: 'graphql-response-captured',
          graphqlResponses: [
            {
              operationName,
              query,
              variables,
              response: responseData,
              timestamp: Date.now(),
              url,
              duration,
            },
          ],
        },
      },
    };

    window.postMessage(message, '*');
  } catch {
    // Silently fail if response is not JSON
  }

  return response;
};

// Intercept XMLHttpRequest for GraphQL requests
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalXHROpen = XMLHttpRequest.prototype.open;
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalXHRSend = XMLHttpRequest.prototype.send;

interface ExtendedXHR extends XMLHttpRequest {
  _url?: string;
  _method?: string;
  _isMocked?: boolean;
  _graphqlData?: {
    operationName: string;
    query?: string;
    variables?: Record<string, unknown>;
    url: string;
    startTime: number;
  };
  _graphqlSent?: boolean;
}

XMLHttpRequest.prototype.open = function (
  this: ExtendedXHR,
  method: string,
  url: string | URL,
  ...rest: [boolean?, string?, string?]
) {
  const urlString = typeof url === 'string' ? url : url.toString();
  this._url = urlString;
  this._method = method;

  // Add event listeners early for GraphQL requests
  if (urlString.includes('/graphql') && method === 'POST') {
    this.addEventListener('load', function (this: ExtendedXHR) {
      // Skip if this is a mocked request
      if (this._isMocked) {
        return;
      }

      const graphqlData = this._graphqlData;

      if (!graphqlData) {
        return;
      }

      if (this._graphqlSent) {
        return;
      }

      this._graphqlSent = true;

      const duration = Math.round(performance.now() - graphqlData.startTime);

      try {
        let responseData: JsonValue;

        // Handle different responseType
        if (this.responseType === '' || this.responseType === 'text') {
          responseData = JSON.parse(this.responseText) as JsonValue;
        } else if (this.responseType === 'json') {
          responseData = this.response as JsonValue;
        } else if (this.responseType === 'arraybuffer') {
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(this.response as ArrayBuffer);
          responseData = JSON.parse(text) as JsonValue;
        } else {
          responseData = this.response as JsonValue;
          if (typeof responseData === 'string') {
            responseData = JSON.parse(responseData) as JsonValue;
          }
        }

        window.postMessage(
          {
            source: 'graphql-mocker-web-page',
            data: {
              from: 'content-script',
              to: 'datastore',
              msg: {
                type: 'graphql-response-captured',
                graphqlResponses: [
                  {
                    operationName: graphqlData.operationName,
                    query: graphqlData.query,
                    variables: graphqlData.variables,
                    response: responseData,
                    timestamp: Date.now(),
                    url: graphqlData.url,
                    duration,
                  },
                ],
              },
            },
          },
          '*'
        );
      } catch {
        // Silent error - response might not be JSON
      }
    });
  }

  return originalXHROpen.apply(this, [method, url, ...rest] as Parameters<typeof originalXHROpen>);
};

XMLHttpRequest.prototype.send = function (
  this: ExtendedXHR,
  body?: Document | XMLHttpRequestBodyInit | null
) {
  // Check if this is a mocked request
  if (this._isMocked) {
    return; // Don't send mocked requests
  }

  const url = this._url;
  const method = this._method;
  const startTime = performance.now();

  if (url && url.includes('/graphql') && method === 'POST') {
    let operationName = 'unknown';
    let query: string | undefined;
    let variables: Record<string, unknown> | undefined;

    try {
      if (body && typeof body === 'string') {
        const parsedBody = JSON.parse(body) as {
          query?: string;
          operationName?: string;
          variables?: Record<string, unknown>;
        };

        if (parsedBody.query || parsedBody.operationName) {
          operationName = parsedBody.operationName || 'unknown';
          query = parsedBody.query;
          variables = parsedBody.variables;

          // Check if we have a custom response for this operation
          const customResponse = customGraphQLResponses.get(operationName);
          if (customResponse?.activated && mockerSettings.globalMockEnabled) {
            // Mark as mocked to prevent actual request
            this._isMocked = true;

            // Mock the XHR response
            const mockResponseText = JSON.stringify(customResponse.response);
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const xhr = this;

            // Store original responseType
            const responseType = xhr.responseType || '';

            // Prepare response based on responseType
            let mockResponse: JsonValue | ArrayBuffer | Blob;
            if (responseType === 'json') {
              mockResponse = customResponse.response;
            } else if (responseType === 'arraybuffer') {
              const encoder = new TextEncoder();
              mockResponse = encoder.encode(mockResponseText).buffer;
            } else if (responseType === 'blob') {
              mockResponse = new Blob([mockResponseText], {
                type: 'application/json',
              });
            } else {
              mockResponse = mockResponseText;
            }

            // Override response properties with getters
            Object.defineProperty(xhr, 'responseText', {
              configurable: true,
              get: () => mockResponseText,
            });
            Object.defineProperty(xhr, 'response', {
              configurable: true,
              get: () => mockResponse,
            });
            Object.defineProperty(xhr, 'status', {
              configurable: true,
              get: () => 200,
            });
            Object.defineProperty(xhr, 'statusText', {
              configurable: true,
              get: () => 'OK',
            });
            Object.defineProperty(xhr, 'readyState', {
              configurable: true,
              get: () => 4,
            });

            // Apply delay if configured
            const mockDelay = customResponse.delay || 10;

            // Trigger events asynchronously
            setTimeout(() => {
              const duration = Math.round(performance.now() - startTime);

              // Send captured response to extension
              window.postMessage(
                {
                  source: 'graphql-mocker-web-page',
                  data: {
                    from: 'content-script',
                    to: 'datastore',
                    msg: {
                      type: 'graphql-response-captured',
                      graphqlResponses: [
                        {
                          operationName,
                          query,
                          variables,
                          response: customResponse.response,
                          timestamp: Date.now(),
                          url,
                          duration,
                        },
                      ],
                    },
                  },
                },
                '*'
              );

              if (xhr.onreadystatechange) {
                const event = new Event('readystatechange');
                xhr.onreadystatechange.call(xhr, event);
              }

              const loadEvent = new ProgressEvent('load', {
                lengthComputable: true,
                loaded: mockResponseText.length,
                total: mockResponseText.length,
              });
              if (xhr.onload) {
                xhr.onload.call(xhr, loadEvent);
              }
              xhr.dispatchEvent(loadEvent);

              const loadendEvent = new ProgressEvent('loadend', {
                lengthComputable: true,
                loaded: mockResponseText.length,
                total: mockResponseText.length,
              });
              if (xhr.onloadend) {
                xhr.onloadend.call(xhr, loadendEvent);
              }
              xhr.dispatchEvent(loadendEvent);
            }, mockDelay);

            return; // Don't send the actual request
          }

          // Store data for later use
          this._graphqlData = {
            operationName,
            query,
            variables,
            url,
            startTime,
          };
        }
      }
    } catch {
      // Parsing error - silently continue
    }
  }

  return originalXHRSend.apply(this, [body] as [
    Document | XMLHttpRequestBodyInit | null | undefined,
  ]);
};

// Make this script a module
export {};
