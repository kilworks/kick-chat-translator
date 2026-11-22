"""Export a LID2 model (train_nn.py) to ONNX, only to look at its graph in Netron.

python tools/lid/onnx_export.py --data <data-dir> --model NAME    -> <data>/lid/models/NAME.onnx
<data>/lid/venv/Scripts/netron <data>/lid/models/NAME.onnx

Graph: hashed n-gram ids -> embedding rows (Gather) -> mean -> dense + ReLU -> dense -> / temperature -> softmax,
the same computation as blob.probs; the 42 language codes are in the model metadata.
"""
import argparse
import pathlib

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

import blob


def build(m):
    E, b1, W1, b2, W2 = (np.ascontiguousarray(x, np.float32) for x in m['mlp'])
    init = [numpy_helper.from_array(a, n) for a, n in ((E, 'embedding'), (W1, 'W1'), (b1, 'b1'), (W2, 'W2'), (b2, 'b2'),
                                                        (np.array(m['T'], np.float32), 'temperature'))]
    nodes = [
        helper.make_node('Gather', ['embedding', 'ngram_ids'], ['rows']),
        helper.make_node('ReduceMean', ['rows'], ['mean'], axes=[0], keepdims=1),
        helper.make_node('MatMul', ['mean', 'W1'], ['h_pre0']),
        helper.make_node('Add', ['h_pre0', 'b1'], ['h_pre']),
        helper.make_node('Relu', ['h_pre'], ['hidden']),
        helper.make_node('MatMul', ['hidden', 'W2'], ['z0']),
        helper.make_node('Add', ['z0', 'b2'], ['logits']),
        helper.make_node('Div', ['logits', 'temperature'], ['calibrated']),
        helper.make_node('Softmax', ['calibrated'], ['language_probs'], axis=1),
    ]
    g = helper.make_graph(nodes, 'kct-lid', [helper.make_tensor_value_info('ngram_ids', TensorProto.INT64, ['n'])],
                          [helper.make_tensor_value_info('language_probs', TensorProto.FLOAT, [1, len(m['labels'])])], init)
    model = helper.make_model(g, opset_imports=[helper.make_opsetid('', 13)], producer_name='kct tools/lid')
    helper.set_model_props(model, {'labels': ' '.join(m['labels']), 'buckets': str(m['B'])})
    onnx.checker.check_model(model)
    return model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--model', required=True)
    a = ap.parse_args()
    models = pathlib.Path(a.data) / 'lid' / 'models'
    out = models / f'{a.model}.onnx'
    onnx.save(build(blob.load(models / f'{a.model}.bin')), out)
    print(out)


if __name__ == '__main__':
    main()
