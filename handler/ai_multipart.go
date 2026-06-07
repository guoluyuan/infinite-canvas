package handler

import (
	"bytes"
	"io"
	"mime"
	"mime/multipart"
	"strings"
)

func normalizeAIProxyRequestBody(body []byte, contentType string, modelName string, path string) ([]byte, string, error) {
	if path != "/images/edits" || !isGrokImageModel(modelName) || !strings.HasPrefix(contentType, "multipart/form-data") {
		return body, contentType, nil
	}
	return replaceMultipartValue(body, contentType, "model", "grok-imagine-image-edit")
}

func replaceMultipartValue(body []byte, contentType string, key string, value string) ([]byte, string, error) {
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, "", err
	}
	form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(32 << 20)
	if err != nil {
		return nil, "", err
	}
	defer form.RemoveAll()
	form.Value[key] = []string{value}
	return encodeMultipartForm(form)
}

func encodeMultipartForm(form *multipart.Form) ([]byte, string, error) {
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	for key, values := range form.Value {
		for _, value := range values {
			if err := writer.WriteField(key, value); err != nil {
				return nil, "", err
			}
		}
	}
	if err := copyMultipartFiles(writer, form.File); err != nil {
		return nil, "", err
	}
	if err := writer.Close(); err != nil {
		return nil, "", err
	}
	return buffer.Bytes(), writer.FormDataContentType(), nil
}

func copyMultipartFiles(writer *multipart.Writer, files map[string][]*multipart.FileHeader) error {
	for _, headers := range files {
		for _, header := range headers {
			if err := copyMultipartFile(writer, header); err != nil {
				return err
			}
		}
	}
	return nil
}

func copyMultipartFile(writer *multipart.Writer, header *multipart.FileHeader) error {
	file, err := header.Open()
	if err != nil {
		return err
	}
	defer file.Close()
	part, err := writer.CreatePart(header.Header)
	if err != nil {
		return err
	}
	_, err = io.Copy(part, file)
	return err
}

func isGrokImageModel(modelName string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(modelName)), "grok-imagine-image")
}
