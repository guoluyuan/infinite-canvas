package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

func copyGrokImageResponse(w http.ResponseWriter, response *http.Response, options aiProxyCopyOptions) {
	body, changed, err := normalizeGrokImageResponse(options.Request.Context(), response.Body, options.APIKey)
	if err != nil {
		logGrokImageResponseError(options, err)
		options.fail()
		Fail(w, "AI 接口请求失败")
		return
	}
	copyAIResponseHeaders(w, response)
	if changed {
		w.Header().Set("Content-Type", "application/json")
	}
	w.WriteHeader(response.StatusCode)
	_, _ = w.Write(body)
}

func normalizeGrokImageResponse(ctx context.Context, body io.Reader, apiKey string) ([]byte, bool, error) {
	raw, err := io.ReadAll(body)
	if err != nil {
		return nil, false, err
	}
	payload, changed, err := replaceGrokImageURLs(ctx, raw, apiKey)
	if err != nil || !changed {
		return raw, false, err
	}
	normalized, err := json.Marshal(payload)
	return normalized, true, err
}

func replaceGrokImageURLs(ctx context.Context, raw []byte, apiKey string) (map[string]interface{}, bool, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, false, nil
	}
	items, ok := payload["data"].([]interface{})
	if !ok {
		return payload, false, nil
	}
	changed, err := replaceGrokImageItems(ctx, items, apiKey)
	return payload, changed, err
}

func replaceGrokImageItems(ctx context.Context, items []interface{}, apiKey string) (bool, error) {
	changed := false
	for _, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		itemChanged, err := replaceGrokImageItem(ctx, itemMap, apiKey)
		if err != nil {
			return false, err
		}
		changed = changed || itemChanged
	}
	return changed, nil
}

func replaceGrokImageItem(ctx context.Context, item map[string]interface{}, apiKey string) (bool, error) {
	imageURL, ok := item["url"].(string)
	if !ok || imageURL == "" {
		return false, nil
	}
	b64, err := downloadGrokImageAsBase64(ctx, imageURL, apiKey)
	if err != nil {
		return false, err
	}
	item["b64_json"] = b64
	delete(item, "url")
	return true, nil
}

func downloadGrokImageAsBase64(ctx context.Context, imageURL string, apiKey string) (string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+apiKey)
	response, err := aiProxyHTTPClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusBadRequest {
		return "", fmt.Errorf("download image failed: %d", response.StatusCode)
	}
	data, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

func logGrokImageResponseError(options aiProxyCopyOptions, err error) {
	log.Printf("AI proxy grok image response failed: url=%s model=%s err=%v", options.Request.URL.String(), options.ModelName, err)
}
